import { NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { client } from '@/sanity/lib/client';
import { productSlugsByShopifyHandleQuery } from '@/sanity/lib/queries';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';
import { isShopifyConfigured } from '@/lib/shopify/client';
import {
	addCartLines,
	CartNotFoundError,
	createCart,
	getCart,
	removeCartLine,
	updateCartLine,
} from '@/lib/shopify/cart';
import {
	MAX_LINE_QUANTITY,
	type ShopifyCart,
	type ShopifyCartResponse,
} from '@/lib/shopify/types';

// Cart endpoint for the on-site store. The cart id lives in an httpOnly cookie
// rather than in client state: it is a capability (anyone holding it can read
// and mutate the cart), so it must never be reachable from page scripts.
//
// Every response returns the whole cart, so the client renders one
// authoritative snapshot instead of reconciling quantities locally.

const CART_COOKIE = 'blackwater_cart';
// Shopify expires carts after roughly 10 days of inactivity. Two weeks lets the
// cookie outlive the cart by a small margin; a cookie pointing at an expired
// cart is handled below rather than being an error.
const CART_COOKIE_MAX_AGE = 14 * 24 * 60 * 60;

const GID = /^gid:\/\/shopify\/[A-Za-z]+\/[\w?=&-]+$/;

const bodySchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('add'),
		merchandiseId: z.string().trim().regex(GID),
		quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
	}),
	z.object({
		action: z.literal('update'),
		lineId: z.string().trim().min(1).max(300),
		quantity: z.number().int().min(0).max(MAX_LINE_QUANTITY),
	}),
	z.object({
		action: z.literal('remove'),
		lineId: z.string().trim().min(1).max(300),
	}),
]);

// Best-effort per-IP throttle, matching the other third-party proxy routes.
// Deliberately generous: the private Storefront token is rate-limited shop-wide,
// so abuse here degrades the whole site — but a shopper hammering the quantity
// stepper must never trip it.
//
// Reads and writes get separate budgets under one map. Both reach Shopify
// uncached, so throttling only writes would leave GET as a free amplifier: mint
// one cart, then replay the read forever. GET is the looser of the two because
// every page load hydrates the cart once, and shared egress IPs (office NAT,
// carrier CGNAT) multiply that across unrelated visitors.
const READ_RATE_LIMIT = 240;
const WRITE_RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;
// Worst-case retained timestamps is MAX_TRACKED_KEYS * READ_RATE_LIMIT, so
// derive the key cap from the larger limit — otherwise raising a limit silently
// raises peak memory by the same factor.
const MAX_TRACKED_TIMESTAMPS = 300_000;
const MAX_TRACKED_KEYS = Math.ceil(MAX_TRACKED_TIMESTAMPS / READ_RATE_LIMIT);
const requestTimes = new Map<string, number[]>();

function isRateLimited(key: string, limit: number): boolean {
	if (requestTimes.size > MAX_TRACKED_KEYS) requestTimes.clear();
	const now = Date.now();
	const recent = (requestTimes.get(key) ?? []).filter(
		(t) => now - t < RATE_WINDOW_MS
	);
	if (recent.length >= limit) {
		requestTimes.set(key, recent);
		return true;
	}
	recent.push(now);
	requestTimes.set(key, recent);
	return false;
}

function clientIp(req: NextRequest): string {
	return (
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		req.headers.get('x-real-ip') ||
		'unknown'
	);
}

// No cart to act on: either no cookie at all, or one whose cart Shopify has
// already dropped. Clearing the cookie is safe in both cases and stops a dead
// id from being retried on every later request.
function noCart() {
	const res = NextResponse.json(
		{ ok: false, message: 'No cart.' },
		{ status: 409 }
	);
	res.cookies.delete(CART_COOKIE);
	return res;
}

function tooManyRequests() {
	return NextResponse.json(
		{ ok: false, message: 'Too many requests. Try again later.' },
		{ status: 429 }
	);
}

/**
 * Bound on the slug lookup. The enrichment is decoration — it only decides
 * whether a thumbnail is a link — but it sits in front of the response that
 * carries the cart cookie, so an unresponsive Sanity must never be able to hold
 * a freshly created cart's id hostage: without the Set-Cookie the shopper's new
 * cart is orphaned and their item silently vanishes. The signal aborts the
 * request rather than just abandoning the wait.
 */
const SLUG_LOOKUP_TIMEOUT_MS = 400;

/**
 * Attaches each line's Sanity product slug, so the drawer can link a line back
 * to its product page. Shopify knows only its own handle; product routes are
 * keyed on the Sanity slug, and the two are independent by design.
 *
 * Resolved per response rather than captured as a cart-line attribute when the
 * line is added: an editor can rename a slug at any time, and a copy stored in
 * Shopify would then point at a 404. Enriching every response (not just reads)
 * is required, because the client replaces its snapshot wholesale — an
 * unenriched mutation response would drop every link.
 *
 * Soft-fails in both directions: a Sanity error, or a lookup slower than
 * SLUG_LOOKUP_TIMEOUT_MS, costs the links and nothing else.
 */
async function withProductSlugs(
	cart: ShopifyCart,
	locale: Locale
): Promise<ShopifyCartResponse> {
	const handles = [
		...new Set(
			cart.lines.map((l) => l.merchandise.productHandle).filter(Boolean)
		),
	];
	if (handles.length === 0) return cart;

	const slugs = new Map<string, string | null>();
	try {
		// Cached and tagged like every other Sanity read in the app: slugs change
		// on an editor action, not per request, and this call would otherwise be a
		// live round trip on every page load and every quantity step. The
		// `pProduct` tag is what /api/revalidate-tag already fires on a product
		// webhook, so an edit still lands without waiting out the TTL.
		const rows = await client.fetch(
			productSlugsByShopifyHandleQuery,
			{ handles, locale },
			{
				stega: false,
				signal: AbortSignal.timeout(SLUG_LOOKUP_TIMEOUT_MS),
				next: { revalidate: 3600, tags: ['pProduct'] },
			}
		);
		for (const row of rows) {
			if (!row.handle || !row.slug) continue;
			// Two product documents can claim one handle — `shopify.handle` carries
			// no uniqueness rule (unlike the slug, which is isUniqueAcrossType), so
			// a duplicate is an editor mistake we can see but cannot resolve:
			// nothing here says which product the shopper actually bought. A
			// contested handle gets no link rather than an arbitrary one.
			slugs.set(row.handle, slugs.has(row.handle) ? null : row.slug);
		}
	} catch (err) {
		console.error('[shopify-cart] product slug lookup failed', err);
	}

	return {
		...cart,
		lines: cart.lines.map((line) => ({
			...line,
			merchandise: {
				...line.merchandise,
				productSlug: slugs.get(line.merchandise.productHandle) ?? null,
			},
		})),
	};
}

async function cartResponse(cart: ShopifyCart | null, locale: Locale) {
	const res = NextResponse.json({
		ok: true,
		cart: cart && (await withProductSlugs(cart, locale)),
	});
	if (cart) {
		res.cookies.set(CART_COOKIE, cart.id, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			path: '/',
			maxAge: CART_COOKIE_MAX_AGE,
		});
	} else {
		res.cookies.delete(CART_COOKIE);
	}
	return res;
}

export async function GET(req: NextRequest) {
	if (!isShopifyConfigured()) return NextResponse.json({ ok: true, cart: null });

	const cartId = req.cookies.get(CART_COOKIE)?.value;
	if (!cartId) return NextResponse.json({ ok: true, cart: null });

	// Reads carry the locale too (POST has it in the body): it decides which
	// products are visible, and therefore which lines get a link.
	const rawLocale = req.nextUrl.searchParams.get('locale');
	const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

	// Throttled only past this point: a request with no cart cookie never
	// reaches Shopify, so it costs nothing and must not consume a visitor's
	// budget on their first page load.
	if (isRateLimited(`r:${clientIp(req)}`, READ_RATE_LIMIT)) {
		return tooManyRequests();
	}

	try {
		// A cart that has expired out from under the cookie reads as null; clear
		// the cookie so the next add starts fresh instead of retrying a dead id.
		return cartResponse(await getCart(cartId), locale);
	} catch (err) {
		console.error('[shopify-cart] GET failed', err);
		return NextResponse.json(
			{ ok: false, message: 'Could not load your cart.' },
			{ status: 502 }
		);
	}
}

export async function POST(req: NextRequest) {
	if (!isShopifyConfigured()) {
		console.error('[shopify-cart] Shopify is not configured');
		return NextResponse.json(
			{ ok: false, message: 'Store is not configured.' },
			{ status: 503 }
		);
	}

	if (isRateLimited(`w:${clientIp(req)}`, WRITE_RATE_LIMIT)) {
		return tooManyRequests();
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json(
			{ ok: false, message: 'Invalid request body.' },
			{ status: 400 }
		);
	}

	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ ok: false, message: 'Invalid cart request.' },
			{ status: 400 }
		);
	}
	const input = parsed.data;
	const rawLocale = (body as { locale?: unknown }).locale;
	const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

	const cartId = req.cookies.get(CART_COOKIE)?.value;

	try {
		if (input.action === 'add') {
			const lines = [
				{ merchandiseId: input.merchandiseId, quantity: input.quantity },
			];
			// No cookie, or the cart behind it has expired — start a new one. The
			// expiry check is a real path, not a guard: carts routinely die before
			// the cookie does.
			const existing = cartId ? await getCart(cartId) : null;
			if (!existing) return cartResponse(await createCart(lines, locale), locale);

			// cartLinesAdd accumulates onto a line that already holds this variant,
			// so the per-line ceiling has to be applied to the *result*. Validating
			// only the increment would let repeated adds walk a line past the max
			// the stepper then refuses to move.
			const line = existing.lines.find(
				(l) => l.merchandise.gid === input.merchandiseId
			);
			if (line) {
				const next = Math.min(
					line.quantity + input.quantity,
					MAX_LINE_QUANTITY
				);
				// Already at the ceiling — nothing to send, but still answer with the
				// current cart so the client stays in sync.
				if (next === line.quantity) return cartResponse(existing, locale);
				return cartResponse(
					await updateCartLine(existing.id, line.id, next),
					locale
				);
			}
			return cartResponse(await addCartLines(existing.id, lines), locale);
		}

		// update/remove address a line that must already exist. Without a live
		// cart there is nothing to act on, and creating one here would silently
		// discard the shopper's request.
		if (!cartId) return noCart();

		if (input.action === 'remove' || input.quantity === 0) {
			return cartResponse(await removeCartLine(cartId, input.lineId), locale);
		}
		return cartResponse(
			await updateCartLine(cartId, input.lineId, input.quantity),
			locale
		);
	} catch (err) {
		// The cart died under the cookie — normal at ~10 days idle, not an
		// outage. Answer the same 409 as a missing cookie and drop the stale id,
		// so the next add starts fresh instead of the shopper retrying a dead
		// cart against a generic 502 forever. Mirrors GET, which clears the
		// cookie when the cart reads back null.
		if (err instanceof CartNotFoundError) return noCart();
		console.error(`[shopify-cart] ${input.action} failed`, err);
		return NextResponse.json(
			{ ok: false, message: 'Could not update your cart.' },
			{ status: 502 }
		);
	}
}
