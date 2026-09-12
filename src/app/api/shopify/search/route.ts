/**
 * Product search for the Studio's Shopify picker (ShopifyProductInput).
 * Proxies the Storefront GraphQL API so the access token stays server-side —
 * needs SHOPIFY_STORE_DOMAIN + a Storefront token (see docs/SHOPIFY-SETUP.md).
 *
 * The embedded Studio authenticates against *.api.sanity.io, so no session
 * cookie reaches this origin and the route cannot identify its caller — treat
 * it as publicly reachable. That is safe by construction here: a Storefront
 * token resolves only products published to its sales channel, so the worst
 * case is disclosing data the public storefront already serves. It also means
 * the picker offers exactly the products the product page can resolve, rather
 * than any active-but-unpublished product the Admin API would have surfaced.
 *
 * Queries carry the same @inContext market as the page will use, so a product
 * that resolves here also resolves on the product page in that locale.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';
import {
	isShopifyConfigured,
	shopifyStorefrontFetch,
	shopifyStoreDomain,
} from '@/lib/shopify/client';
import { LOCALE_SHOPIFY_CONTEXT, shopifyGidToId } from '@/lib/shopify/types';

const MAX_RESULTS = 10;

// Best-effort per-IP throttle, mirroring the other third-party proxy routes.
// In-memory, so it's per server instance — enough to stop scripted abuse of
// our own function invocations and the Storefront token's rate bucket. Sized
// for real editing: one request per debounced keystroke-pause, plus one handle
// lookup per document opened.
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 10 * 60 * 1000;
// Worst-case retained timestamps is MAX_TRACKED_IPS * RATE_LIMIT, so derive
// the IP cap from RATE_LIMIT — otherwise raising the limit silently raises
// peak memory by the same factor.
const MAX_TRACKED_TIMESTAMPS = 300_000;
const MAX_TRACKED_IPS = Math.ceil(MAX_TRACKED_TIMESTAMPS / RATE_LIMIT);
const requestTimes = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
	if (requestTimes.size > MAX_TRACKED_IPS) requestTimes.clear();
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

const PRODUCT_FIELDS = `
	id
	handle
	title
	featuredImage { url }
`;

const CONTEXT_ARGS = `$country: CountryCode, $language: LanguageCode`;
const IN_CONTEXT = `@inContext(country: $country, language: $language)`;

// Exact lookup for a handle already stored in Sanity. The handle travels as a
// GraphQL variable, so there is no search syntax to escape and no near-miss
// tokenized match — product(handle:) resolves the same way the storefront does.
const BY_HANDLE_QUERY = `
	query StudioProductByHandle($handle: String!, ${CONTEXT_ARGS}) ${IN_CONTEXT} {
		product(handle: $handle) { ${PRODUCT_FIELDS} }
	}
`;

// Free-text search. Storefront products(query:) accepts only field filters
// (title:, tag:, vendor:), not free text, so this uses search(). prefix: LAST
// gives partial matching on the final term, which is what an as-you-type
// picker needs; unavailableProducts: SHOW keeps sold-out products linkable
// (the site has a back-in-stock flow, so hiding them would be wrong).
const SEARCH_QUERY = `
	query StudioProductSearch($query: String!, $first: Int!, ${CONTEXT_ARGS}) ${IN_CONTEXT} {
		search(
			query: $query
			first: $first
			types: [PRODUCT]
			prefix: LAST
			unavailableProducts: SHOW
		) {
			nodes {
				... on Product { ${PRODUCT_FIELDS} }
			}
		}
	}
`;

// Fallback for the two ways search() can come up empty through no fault of the
// query: it is backed by the store's search index (a new or reindexing store
// returns nothing), and its argument list has shifted across API versions, so
// a pinned SHOPIFY_API_VERSION may reject prefix/unavailableProducts outright.
// products(query: "title:…*") is a direct field match present in every version.
const TITLE_SEARCH_QUERY = `
	query StudioProductTitleSearch($query: String!, $first: Int!, ${CONTEXT_ARGS}) ${IN_CONTEXT} {
		products(first: $first, query: $query) {
			nodes { ${PRODUCT_FIELDS} }
		}
	}
`;

type GqlProductNode = {
	id: string;
	handle: string;
	title: string;
	featuredImage: { url: string } | null;
};

// search() returns a SearchResultItem union; non-Product members come back as
// empty objects that the inline fragment doesn't fill in.
function isProductNode(node: Partial<GqlProductNode>): node is GqlProductNode {
	return Boolean(node?.id && node.handle);
}

/**
 * Flattens Shopify search-syntax metacharacters to spaces. Editors type
 * product names, not queries, but Shopify parses quotes, backslashes, parens
 * and colons as structure — an unbalanced one is a *syntax error*, not a
 * no-match, so `Jacket 5"` or `Men's (Blue` would 502 the whole request.
 */
function sanitizeSearchTerm(text: string): string {
	return text
		.replace(/["'\\()[\]{}:*~^]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function sameOrigin(req: NextRequest): boolean {
	const origin = req.headers.get('origin');
	// Absent Origin (non-browser callers) can't be judged, so it passes here —
	// this only turns away cross-site browser callers cheaply.
	if (!origin) return true;
	try {
		return new URL(origin).host === req.nextUrl.host;
	} catch {
		// Opaque/malformed Origin ("null" from a sandboxed iframe) — reject,
		// but never let the URL parser throw an unhandled 500.
		return false;
	}
}

function contextVariables(locale: Locale) {
	const context = LOCALE_SHOPIFY_CONTEXT[locale];
	return {
		country: context?.country ?? null,
		language: context?.language ?? null,
	};
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

	// 503 must mean "not configured" and nothing else: the picker latches on it
	// and degrades to a plain string input for the rest of the session. Every
	// other failure falls through to the 502 below, which it renders as a
	// transient error while staying a picker.
	if (!isShopifyConfigured()) {
		return NextResponse.json(
			{ ok: false, message: 'Shopify search is not configured.' },
			{ status: 503 }
		);
	}

	const q = req.nextUrl.searchParams.get('q')?.trim().slice(0, 64);
	const handle = req.nextUrl.searchParams.get('handle')?.trim().slice(0, 200);
	if (!handle && !q) {
		return NextResponse.json(
			{ ok: false, message: 'Missing q or handle parameter.' },
			{ status: 400 }
		);
	}

	// Resolve in the same market the product page will use, so anything
	// pickable here is also resolvable there.
	const localeParam = req.nextUrl.searchParams.get('locale');
	const context = contextVariables(
		isLocale(localeParam) ? localeParam : DEFAULT_LOCALE
	);

	try {
		let nodes: GqlProductNode[];
		if (handle) {
			const data = await shopifyStorefrontFetch<{
				product: GqlProductNode | null;
			}>({
				query: BY_HANDLE_QUERY,
				variables: { handle, ...context },
				cache: 'no-store',
			});
			nodes = data.product ? [data.product] : [];
		} else {
			const term = sanitizeSearchTerm(q as string);
			// Nothing but punctuation — no query to run, and an empty one errors.
			if (!term) return NextResponse.json({ ok: true, products: [] });
			nodes = await searchProducts(term, context);
		}

		const domain = shopifyStoreDomain();
		// Unreachable after isShopifyConfigured(); throw rather than build
		// admin URLs with an empty store slug if that ever stops holding.
		if (!domain) throw new Error('Shopify store domain is not configured');
		// admin.shopify.com addresses stores by the myshopify subdomain.
		const storeSubdomain = domain.replace(/\.myshopify\.com$/, '');
		const products = nodes.map((node) => {
			const id = shopifyGidToId(node.id);
			return {
				id,
				handle: node.handle,
				title: node.title,
				imageUrl: node.featuredImage?.url ?? null,
				adminUrl: `https://admin.shopify.com/store/${storeSubdomain}/products/${id}`,
			};
		});
		return NextResponse.json({ ok: true, products });
	} catch (err) {
		console.error('[shopify-search] fetch error', err);
		return NextResponse.json({ ok: false }, { status: 502 });
	}
}

async function searchProducts(
	term: string,
	context: ReturnType<typeof contextVariables>
): Promise<GqlProductNode[]> {
	try {
		const data = await shopifyStorefrontFetch<{
			search: { nodes: Array<Partial<GqlProductNode>> };
		}>({
			query: SEARCH_QUERY,
			variables: { query: term, first: MAX_RESULTS, ...context },
			cache: 'no-store',
		});
		const nodes = (data.search?.nodes ?? []).filter(isProductNode);
		if (nodes.length > 0) return nodes;
	} catch (err) {
		// Logged, not rethrown: the title fallback below is the whole point.
		console.warn('[shopify-search] search() failed, trying title match', err);
	}

	const data = await shopifyStorefrontFetch<{
		products: { nodes: GqlProductNode[] };
	}>({
		query: TITLE_SEARCH_QUERY,
		variables: {
			query: `title:${term}*`,
			first: MAX_RESULTS,
			...context,
		},
		cache: 'no-store',
	});
	return data.products?.nodes ?? [];
}
