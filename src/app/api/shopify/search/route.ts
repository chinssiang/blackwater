/**
 * Product search for the Studio's Shopify picker (ShopifyProductInput).
 * Proxies the Admin GraphQL API so the admin token never leaves the server —
 * needs a custom-app Admin token with the read_products scope in
 * SHOPIFY_ADMIN_API_TOKEN.
 *
 * The Admin API returns DRAFT and ARCHIVED products, which are NOT public. The
 * embedded Studio authenticates against *.api.sanity.io, so no session cookie
 * reaches this origin and the route cannot identify its caller — treat it as
 * publicly reachable and make it safe by construction instead:
 *   - every query is ANDed with `status:active`, so only products that are
 *     already public can ever be returned (these are also the only ones the
 *     Storefront API can resolve, i.e. the only linkable ones),
 *   - the caller's search text is escaped into one quoted term so it cannot
 *     inject Shopify search-syntax filters,
 *   - requests are throttled per IP to protect the shop-wide Admin API bucket.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_VERSION_FALLBACK = '2026-01';
const MAX_RESULTS = 10;

// Best-effort per-IP throttle, mirroring the other third-party proxy routes.
// In-memory, so it's per server instance — enough to stop scripted abuse of
// the shop-wide Admin API rate bucket.
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const requestTimes = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
	if (requestTimes.size > 10_000) requestTimes.clear();
	const now = Date.now();
	const recent = (requestTimes.get(ip) ?? []).filter(
		(t) => now - t < RATE_WINDOW_MS
	);
	if (recent.length >= RATE_LIMIT) {
		requestTimes.set(ip, recent);
		return true;
	}
	recent.push(now);
	requestTimes.set(ip, recent);
	return false;
}

// Non-negotiable filter ANDed into every query: the Admin API would otherwise
// return DRAFT and ARCHIVED products, which are not public.
const PUBLIC_ONLY = 'status:active';

const SEARCH_QUERY = `
	query StudioProductSearch($query: String!, $first: Int!) {
		products(first: $first, query: $query) {
			nodes {
				id
				handle
				title
				status
				featuredMedia {
					preview {
						image { url }
					}
				}
			}
		}
	}
`;

type GqlProductNode = {
	id: string;
	handle: string;
	title: string;
	status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
	featuredMedia: { preview: { image: { url: string } | null } | null } | null;
};

// Shopify search syntax treats quotes/backslashes/whitespace as structure;
// handles never legitimately contain them.
function sanitizeHandle(handle: string): string {
	return handle.replace(/["'\\\s]/g, '');
}

/**
 * Wraps free-text search input in a quoted term so Shopify treats it as a
 * literal phrase. Without this, `status:draft` is parsed as a field filter and
 * enumerates unreleased products.
 */
function quoteSearchTerm(text: string): string {
	return `"${text.replace(/[\\"]/g, '')}"`;
}

function sameOrigin(req: NextRequest): boolean {
	const origin = req.headers.get('origin');
	// Absent Origin (non-browser callers) can't be judged, so it passes here —
	// this only turns away cross-site browser callers cheaply. The real
	// protection is that the query is pinned to public products.
	if (!origin) return true;
	try {
		return new URL(origin).host === req.nextUrl.host;
	} catch {
		// Opaque/malformed Origin ("null" from a sandboxed iframe) — reject,
		// but never let the URL parser throw an unhandled 500.
		return false;
	}
}

export async function GET(req: NextRequest) {
	if (!sameOrigin(req)) {
		return NextResponse.json({ ok: false }, { status: 403 });
	}

	const ip =
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		req.headers.get('x-real-ip') ||
		'unknown';
	if (isRateLimited(ip)) {
		return NextResponse.json({ ok: false }, { status: 429 });
	}

	const domain = process.env.SHOPIFY_STORE_DOMAIN;
	const token = process.env.SHOPIFY_ADMIN_API_TOKEN;
	if (!domain || !token) {
		return NextResponse.json(
			{ ok: false, message: 'Shopify admin search is not configured.' },
			{ status: 503 }
		);
	}

	const q = req.nextUrl.searchParams.get('q')?.trim().slice(0, 64);
	const handle = req.nextUrl.searchParams.get('handle')?.trim().slice(0, 200);
	const term = handle
		? `handle:${sanitizeHandle(handle)}`
		: q
			? quoteSearchTerm(q)
			: undefined;
	if (!term) {
		return NextResponse.json(
			{ ok: false, message: 'Missing q or handle parameter.' },
			{ status: 400 }
		);
	}
	const query = `${PUBLIC_ONLY} AND ${term}`;

	const version = process.env.SHOPIFY_API_VERSION || API_VERSION_FALLBACK;
	try {
		const res = await fetch(
			`https://${domain}/admin/api/${version}/graphql.json`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Shopify-Access-Token': token,
				},
				body: JSON.stringify({
					query: SEARCH_QUERY,
					variables: { query, first: handle ? 1 : MAX_RESULTS },
				}),
				cache: 'no-store',
			}
		);
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			console.error('[shopify-search] HTTP', res.status, text.slice(0, 300));
			return NextResponse.json({ ok: false }, { status: 502 });
		}
		const json = (await res.json()) as {
			data?: { products?: { nodes?: GqlProductNode[] } };
			errors?: Array<{ message?: string }>;
		};
		if (json.errors?.length) {
			console.error('[shopify-search] GraphQL errors', json.errors);
			return NextResponse.json({ ok: false }, { status: 502 });
		}

		// admin.shopify.com addresses stores by the myshopify subdomain.
		const storeSubdomain = domain.replace(/\.myshopify\.com$/, '');
		const products = (json.data?.products?.nodes ?? []).map((node) => {
			const id = node.id.slice(node.id.lastIndexOf('/') + 1);
			return {
				id,
				handle: node.handle,
				title: node.title,
				status: node.status,
				imageUrl: node.featuredMedia?.preview?.image?.url ?? null,
				adminUrl: `https://admin.shopify.com/store/${storeSubdomain}/products/${id}`,
			};
		});
		return NextResponse.json({ ok: true, products });
	} catch (err) {
		console.error('[shopify-search] fetch error', err);
		return NextResponse.json({ ok: false }, { status: 502 });
	}
}
