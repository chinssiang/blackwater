// Server-only Shopify Storefront API transport. Reads env at call time (not
// module load) so the integration is optional: with no Shopify env configured,
// pages fall back to the manual Sanity fields instead of crashing at import.
//
// Setup — full walkthrough in docs/SHOPIFY-SETUP.md. In short:
//  1. Shopify admin → Sales channels → Headless → Create storefront, then copy
//     the *private* access token into SHOPIFY_STOREFRONT_PRIVATE_TOKEN. Every
//     call in this codebase runs server-side, and Shopify throttles *public*
//     tokens per buyer IP — used from a server, one egress IP would carry the
//     whole site's traffic. The public token still works via
//     SHOPIFY_STOREFRONT_API_TOKEN if that's all you have. (The admin's old
//     "Develop apps" custom-app flow was removed on 2026-01-01.)
//  2. Set SHOPIFY_STORE_DOMAIN to the myshopify.com domain (no protocol),
//     e.g. blackwater-tw.myshopify.com.
//  3. Publish every product that should appear on the site to that storefront —
//     the token only ever resolves products published to its sales channel.
//  4. SHOPIFY_API_VERSION is pinned here and overridable via env — bump it
//     deliberately (quarterly releases, 12-month support window).

const DEFAULT_API_VERSION = '2026-01';

type ShopifyConfig = {
	domain: string;
	token: string;
	/** Private tokens authenticate with a different header than public ones. */
	isPrivateToken: boolean;
	version: string;
};

// Shopify removed admin-created custom apps on 2026-01-01, so the static
// `shpat_` Admin token this integration once used no longer exists. Warn once
// per instance if the retired variable is still set — an `shpss_` value there
// is an app client secret, which is what people reach for when they can't find
// `shpat_`. Lives here rather than in any one route so it fires on every
// Shopify code path, configured or not.
let warnedAboutAdminToken = false;
function warnIfObsoleteAdminToken(): void {
	const stale = process.env.SHOPIFY_ADMIN_API_TOKEN;
	if (!stale || warnedAboutAdminToken) return;
	warnedAboutAdminToken = true;
	console.warn(
		'[shopify] SHOPIFY_ADMIN_API_TOKEN is set but no longer read — this ' +
			'integration is Storefront-API only. Remove it, and set ' +
			'SHOPIFY_STOREFRONT_PRIVATE_TOKEN (or SHOPIFY_STOREFRONT_API_TOKEN) ' +
			'instead (Shopify admin → Sales channels → Headless).' +
			(stale.startsWith('shpss_')
				? ' The current value has an shpss_ prefix, which marks an app client secret, not an access token.'
				: '')
	);
}

function getConfig(): ShopifyConfig | null {
	warnIfObsoleteAdminToken();
	const domain = process.env.SHOPIFY_STORE_DOMAIN;
	const privateToken = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
	const token = privateToken || process.env.SHOPIFY_STOREFRONT_API_TOKEN;
	if (!domain || !token) return null;
	return {
		domain,
		token,
		isPrivateToken: Boolean(privateToken),
		version: process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION,
	};
}

export function isShopifyConfigured(): boolean {
	return getConfig() !== null;
}

export function shopifyStoreDomain(): string | null {
	return getConfig()?.domain ?? null;
}

type StorefrontFetchArgs = {
	query: string;
	variables?: Record<string, unknown>;
	/** Passed through to Next's fetch cache. */
	next?: { revalidate?: number | false; tags?: string[] };
	/** Opt out of caching explicitly ('no-store') rather than relying on the
	 *  framework default — used by the Studio search proxy. */
	cache?: RequestCache;
};

/**
 * Ceiling on how long any one Storefront request may block a render.
 *
 * Neither `fetch` nor Next imposes a default, so without this a Shopify
 * endpoint that accepts a connection and then hangs holds the request open
 * indefinitely. That blast radius is no longer limited to product pages: the
 * empty-cart recommendations are resolved inside `getCachedSiteData`, which
 * every route rendering the site chrome awaits — so an unbounded hang would
 * stall /events and /faq too.
 *
 * Every caller already handles a throw: the catalog fetchers fall back to the
 * manual Sanity fields, and the cart route answers 502. So timing out degrades
 * rather than breaks.
 */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Executes one Storefront GraphQL request and returns `data`. Throws with a
 * descriptive message on missing config, HTTP errors, or GraphQL errors —
 * callers decide whether that's fatal (webhook route) or a soft fallback
 * (page rendering).
 */
export async function shopifyStorefrontFetch<T>({
	query,
	variables,
	next,
	cache,
}: StorefrontFetchArgs): Promise<T> {
	const config = getConfig();
	if (!config) {
		throw new Error(
			'Shopify is not configured (SHOPIFY_STORE_DOMAIN and one of ' +
				'SHOPIFY_STOREFRONT_PRIVATE_TOKEN / SHOPIFY_STOREFRONT_API_TOKEN missing)'
		);
	}

	const res = await fetch(
		`https://${config.domain}/api/${config.version}/graphql.json`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				[config.isPrivateToken
					? 'Shopify-Storefront-Private-Token'
					: 'X-Shopify-Storefront-Access-Token']: config.token,
			},
			body: JSON.stringify({ query, variables }),
			next,
			cache,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		}
	);

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(
			`Shopify Storefront API HTTP ${res.status}: ${text.slice(0, 500)}`
		);
	}

	const json = (await res.json()) as {
		data?: T;
		errors?: Array<{ message?: string }>;
	};

	if (json.errors?.length) {
		throw new Error(
			`Shopify Storefront API GraphQL error: ${json.errors
				.map((e) => e.message)
				.filter(Boolean)
				.join('; ')}`
		);
	}
	if (!json.data) {
		throw new Error('Shopify Storefront API returned no data');
	}
	return json.data;
}
