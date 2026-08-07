import { stegaClean } from '@sanity/client/stega';
import { type Locale } from '@/lib/i18n';
import { interpolate } from '@/lib/dictionary';
import { getDictionary } from '@/lib/dictionary.server';
import {
	isShopifyConfigured,
	shopifyStoreDomain,
	shopifyStorefrontFetch,
} from './client';
import {
	LOCALE_SHOPIFY_CONTEXT,
	formatShopifyPrice,
	shopifyGidToId,
	type CardCommerce,
	type ProductCommerce,
	type ShopifyMoney,
} from './types';

// Server-side product fetchers. Every helper here soft-fails: a missing
// config, an unknown handle, or a Shopify outage yields null/empty (logged)
// and the page renders from the manual Sanity fallback fields — commerce data
// being unreachable must never 500 a product page.

// Backstop TTL. Webhook-driven revalidateTag() is the real freshness
// mechanism; this only bounds staleness if webhooks are missed.
const REVALIDATE_SECONDS = 3600;

// Aliased product(handle:) lookups per request — one round trip per chunk
// while keeping well under Next's 128-tags-per-fetch cache limit.
const CARD_CHUNK_SIZE = 40;

const MONEY_FRAGMENT = `{ amount currencyCode }`;

const PRODUCT_COMMERCE_QUERY = `
	query ProductCommerce($handle: String!, $country: CountryCode, $language: LanguageCode)
		@inContext(country: $country, language: $language) {
		product(handle: $handle) {
			handle
			availableForSale
			onlineStoreUrl
			priceRange {
				minVariantPrice ${MONEY_FRAGMENT}
				maxVariantPrice ${MONEY_FRAGMENT}
			}
			options {
				name
				optionValues { name }
			}
			variants(first: 100) {
				nodes {
					id
					title
					availableForSale
					price ${MONEY_FRAGMENT}
					compareAtPrice ${MONEY_FRAGMENT}
					selectedOptions { name value }
				}
			}
		}
	}
`;

type GqlMoney = ShopifyMoney;

type GqlProduct = {
	handle: string;
	availableForSale: boolean;
	onlineStoreUrl: string | null;
	priceRange: { minVariantPrice: GqlMoney; maxVariantPrice: GqlMoney };
	options: Array<{ name: string; optionValues: Array<{ name: string }> }>;
	variants: {
		nodes: Array<{
			id: string;
			title: string;
			availableForSale: boolean;
			price: GqlMoney;
			compareAtPrice: GqlMoney | null;
			selectedOptions: Array<{ name: string; value: string }>;
		}>;
	};
};

function productUrl(handle: string, onlineStoreUrl: string | null): string {
	if (onlineStoreUrl) return onlineStoreUrl;
	// Not published to the Online Store channel (or URL not exposed) — fall
	// back to the canonical product URL on the store domain.
	return `https://${shopifyStoreDomain()}/products/${handle}`;
}

function normalizeProduct(product: GqlProduct): ProductCommerce {
	return {
		handle: product.handle,
		availableForSale: product.availableForSale,
		url: productUrl(product.handle, product.onlineStoreUrl),
		minPrice: product.priceRange.minVariantPrice,
		maxPrice: product.priceRange.maxVariantPrice,
		options: product.options.map((o) => ({
			name: o.name,
			values: o.optionValues.map((v) => v.name),
		})),
		variants: product.variants.nodes.map((v) => ({
			gid: v.id,
			id: shopifyGidToId(v.id),
			title: v.title,
			availableForSale: v.availableForSale,
			price: v.price,
			compareAtPrice: v.compareAtPrice,
			selectedOptions: v.selectedOptions,
		})),
	};
}

function contextVariables(locale: Locale) {
	const context = LOCALE_SHOPIFY_CONTEXT[locale];
	return {
		country: context?.country ?? null,
		language: context?.language ?? null,
	};
}

export function shopifyProductTags(handle: string): string[] {
	return ['shopify', `shopify:product:${handle}`];
}

/**
 * Full commerce payload (variants, options, prices, availability) for one
 * product, in the given locale's market context. Null when Shopify is not
 * configured, the handle doesn't resolve, or the request fails.
 */
export async function getProductCommerce(
	rawHandle: string | null | undefined,
	locale: Locale
): Promise<ProductCommerce | null> {
	// Handles come from GROQ results, which carry invisible stega characters in
	// draft mode — clean at the boundary or the Shopify lookup silently misses.
	const handle = rawHandle ? stegaClean(rawHandle) : null;
	if (!handle || !isShopifyConfigured()) return null;
	try {
		const data = await shopifyStorefrontFetch<{ product: GqlProduct | null }>({
			query: PRODUCT_COMMERCE_QUERY,
			variables: { handle, ...contextVariables(locale) },
			next: { revalidate: REVALIDATE_SECONDS, tags: shopifyProductTags(handle) },
		});
		if (!data.product) {
			console.warn(`[shopify] no product for handle "${handle}"`);
			return null;
		}
		return normalizeProduct(data.product);
	} catch (err) {
		console.error(`[shopify] getProductCommerce failed for "${handle}"`, err);
		return null;
	}
}

type GqlCardProduct = Pick<
	GqlProduct,
	'handle' | 'availableForSale' | 'priceRange'
>;

function buildCardQuery(handles: string[]): string {
	// Storefront API has no products-by-handles lookup, so alias one
	// product(handle:) field per handle. Handles are serialized with
	// JSON.stringify so arbitrary CMS input can't break out of the literal.
	const fields = handles
		.map(
			(handle, i) => `
		p${i}: product(handle: ${JSON.stringify(handle)}) {
			handle
			availableForSale
			priceRange {
				minVariantPrice ${MONEY_FRAGMENT}
				maxVariantPrice ${MONEY_FRAGMENT}
			}
		}`
		)
		.join('\n');
	return `
	query CardCommerce($country: CountryCode, $language: LanguageCode)
		@inContext(country: $country, language: $language) {
		${fields}
	}
`;
}

/**
 * Batched price/availability lookup for listing cards, keyed by handle.
 * Failed chunks are logged and skipped — affected cards fall back to their
 * manual price string.
 */
export async function getCardCommerce(
	handles: Array<string | null | undefined>,
	locale: Locale
): Promise<Map<string, CardCommerce>> {
	const result = new Map<string, CardCommerce>();
	const unique = [
		...new Set(
			handles
				.map((h) => (h ? stegaClean(h) : null))
				.filter((h): h is string => Boolean(h))
		),
	];
	if (unique.length === 0 || !isShopifyConfigured()) return result;

	const chunks: string[][] = [];
	for (let i = 0; i < unique.length; i += CARD_CHUNK_SIZE) {
		chunks.push(unique.slice(i, i + CARD_CHUNK_SIZE));
	}

	await Promise.all(
		chunks.map(async (chunk) => {
			try {
				const data = await shopifyStorefrontFetch<
					Record<string, GqlCardProduct | null>
				>({
					query: buildCardQuery(chunk),
					variables: contextVariables(locale),
					next: {
						revalidate: REVALIDATE_SECONDS,
						tags: ['shopify', ...chunk.map((h) => `shopify:product:${h}`)],
					},
				});
				for (const product of Object.values(data)) {
					if (!product) continue;
					result.set(product.handle, {
						handle: product.handle,
						availableForSale: product.availableForSale,
						minPrice: product.priceRange.minVariantPrice,
						maxPrice: product.priceRange.maxVariantPrice,
					});
				}
			} catch (err) {
				console.error('[shopify] getCardCommerce chunk failed', err);
			}
		})
	);

	return result;
}

type CardLike = {
	shopifyHandle?: string | null;
	price?: string | null;
};

function liveCardPrice(
	card: CardCommerce,
	locale: Locale,
	fromTemplate: string
): string {
	const single = Number(card.minPrice.amount) === Number(card.maxPrice.amount);
	const min = formatShopifyPrice(card.minPrice, locale);
	return single ? min : interpolate(fromTemplate, { price: min });
}

/**
 * Replaces each card's manual `price` string with its live Shopify price
 * (formatted, "From X" for variant ranges). Cards without a resolvable handle
 * keep their manual price — the shape is unchanged, so ProductCard needs no
 * awareness of Shopify at all.
 */
export function applyCardPrices<T extends CardLike | null>(
	products: ReadonlyArray<T> | null | undefined,
	commerce: Map<string, CardCommerce>,
	locale: Locale,
	fromTemplate: string
): T[] {
	if (!products) return [];
	if (commerce.size === 0) return [...products];
	return products.map((product) => {
		if (!product) return product;
		const handle = product.shopifyHandle
			? stegaClean(product.shopifyHandle)
			: null;
		const card = handle ? commerce.get(handle) : null;
		if (!card) return product;
		// Same shape with only `price` rewritten — safe for the generic.
		return { ...product, price: liveCardPrice(card, locale, fromTemplate) } as T;
	});
}

/**
 * One-call convenience for pages with a single flat card array: fetch + apply.
 * Pages with several arrays (index, product detail) should getCardCommerce()
 * once over all handles and applyCardPrices() per array instead.
 */
export async function withLiveCardPrices<T extends CardLike | null>(
	products: ReadonlyArray<T> | null | undefined,
	locale: Locale
): Promise<T[]> {
	if (!products?.length) return products ? [...products] : [];
	const commerce = await getCardCommerce(
		products.map((p) => p?.shopifyHandle),
		locale
	);
	if (commerce.size === 0) return [...products];
	const dict = await getDictionary(locale);
	return applyCardPrices(products, commerce, locale, dict.products.fromPrice);
}
