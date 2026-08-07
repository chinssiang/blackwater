// Server-only Shopify Storefront API transport. Reads env at call time (not
// module load) so the integration is optional: with no Shopify env configured,
// pages fall back to the manual Sanity fields instead of crashing at import.
//
// Setup (Shopify admin → Settings → Apps and sales channels → Develop apps):
//  1. Create a custom app, enable Storefront API access with the
//     unauthenticated_read_product_listings + unauthenticated_read_product_inventory
//     scopes, and install it.
//  2. Copy the Storefront API access token into SHOPIFY_STOREFRONT_API_TOKEN.
//  3. Set SHOPIFY_STORE_DOMAIN to the myshopify.com domain (no protocol),
//     e.g. blackwater-tw.myshopify.com.
//  4. SHOPIFY_API_VERSION is pinned here and overridable via env — bump it
//     deliberately (quarterly releases, 12-month support window).

const DEFAULT_API_VERSION = '2026-01';

type ShopifyConfig = {
	domain: string;
	token: string;
	version: string;
};

function getConfig(): ShopifyConfig | null {
	const domain = process.env.SHOPIFY_STORE_DOMAIN;
	const token = process.env.SHOPIFY_STOREFRONT_API_TOKEN;
	if (!domain || !token) return null;
	return {
		domain,
		token,
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
};

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
}: StorefrontFetchArgs): Promise<T> {
	const config = getConfig();
	if (!config) {
		throw new Error(
			'Shopify is not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_API_TOKEN missing)'
		);
	}

	const res = await fetch(
		`https://${config.domain}/api/${config.version}/graphql.json`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Shopify-Storefront-Access-Token': config.token,
			},
			body: JSON.stringify({ query, variables }),
			next,
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
