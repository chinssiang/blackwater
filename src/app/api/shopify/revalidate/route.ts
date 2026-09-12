/**
 * Revalidates the cached Shopify Storefront fetches when the store changes.
 * There is deliberately no backstop TTL (see product.ts), so this is the only
 * mechanism that gets admin edits (price, stock, variants) onto product pages
 * without a redeploy.
 *
 * Set up in Shopify admin → Settings → Notifications → Webhooks:
 * 1. Create webhooks (format JSON, latest API version), all pointing at
 *    https://YOUR_SITE_URL/api/shopify/revalidate — one per event:
 *    - "Product update"          → refreshes that product's tag
 *    - "Product deletion"        → broad refresh (payload carries no handle)
 *    - "Inventory level update"  → broad refresh (ditto; drop this webhook if
 *      sales volume makes it too chatty — product updates still cover most
 *      availability flips)
 * 2. Copy the webhook signing secret shown at the bottom of that settings
 *    page into the SHOPIFY_WEBHOOK_SECRET env var (all admin-created webhooks
 *    on a shop share one signing secret).
 * 3. Add it to Vercel (`npx vercel env add SHOPIFY_WEBHOOK_SECRET`) and
 *    redeploy.
 *
 * Caveat: webhooks registered through an *app* instead (Dev Dashboard, or the
 * webhookSubscriptionCreate mutation) are signed with that app's client secret,
 * not the shop's shared webhook secret — SHOPIFY_WEBHOOK_SECRET would then have
 * to hold the client secret. Getting this wrong 401s every delivery silently.
 *
 * "Product creation" isn't worth registering on its own — a new Shopify product
 * changes nothing here until an editor links it in Sanity — but it is handled
 * below so that registering it anyway is harmless.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Topics this route knows how to act on. Anything else is acknowledged and
// ignored rather than triggering a broad invalidation.
const HANDLED_TOPICS = new Set([
	'products/update',
	'products/create',
	'products/delete',
	'inventory_levels/update',
]);

function isValidSignature(
	rawBody: string,
	header: string | null,
	secret: string
): boolean {
	if (!header) return false;
	const digest = createHmac('sha256', secret)
		.update(rawBody, 'utf8')
		.digest('base64');
	const a = Buffer.from(digest);
	const b = Buffer.from(header);
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
	const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
	if (!secret) {
		console.error('[shopify-revalidate] SHOPIFY_WEBHOOK_SECRET is not set');
		return new Response('Not configured', { status: 500 });
	}

	// Signature covers the raw bytes — read text first, parse after verifying.
	const rawBody = await req.text();
	if (
		!isValidSignature(
			rawBody,
			req.headers.get('x-shopify-hmac-sha256'),
			secret
		)
	) {
		console.error('[shopify-revalidate] invalid HMAC signature');
		return new Response('Invalid signature', { status: 401 });
	}

	const topic = req.headers.get('x-shopify-topic');
	if (!topic) {
		return new Response('Bad Request', { status: 400 });
	}

	// Allowlist: a correctly-signed webhook for some unrelated topic (orders,
	// customers) would otherwise trigger a full `shopify` invalidation of every
	// product fetch on the site. Signature proves origin, not relevance.
	if (!HANDLED_TOPICS.has(topic)) {
		return NextResponse.json({ revalidated: false, topic, ignored: true });
	}

	let handle: string | null = null;
	if (topic === 'products/update' || topic === 'products/create') {
		try {
			const body = JSON.parse(rawBody) as { handle?: string };
			handle = body.handle ?? null;
		} catch {
			return new Response('Bad Request', { status: 400 });
		}
	}

	// Deletes and inventory changes carry no handle, so they fall through to
	// the broad tag every Shopify fetch is labeled with. Re-delivered webhooks
	// just revalidate again — idempotent.
	// `{ expire: 0 }`, not 'max' — see the note in /api/revalidate-tag: a named
	// profile only marks the entry stale, so the first shopper after a price
	// change still got the old price from cache.
	if (handle) {
		revalidateTag(`shopify:product:${handle}`, { expire: 0 });
	} else {
		revalidateTag('shopify', { expire: 0 });
	}

	return NextResponse.json({
		revalidated: true,
		topic,
		handle,
		now: Date.now(),
	});
}
