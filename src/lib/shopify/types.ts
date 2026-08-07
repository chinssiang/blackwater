import { htmlLangFor, type Locale } from '@/lib/i18n';

// Client-safe surface of the Shopify integration: types and pure helpers only.
// Server code (env access, fetching) lives in client.ts / product.ts — client
// components must import from this file, never those.

export type ShopifyMoney = {
	amount: string;
	currencyCode: string;
};

export type ShopifySelectedOption = {
	name: string;
	value: string;
};

export type ShopifyVariant = {
	/** Full GID, e.g. gid://shopify/ProductVariant/123 */
	gid: string;
	/** Numeric id extracted from the GID — what ?variant= expects */
	id: string;
	title: string;
	availableForSale: boolean;
	price: ShopifyMoney;
	compareAtPrice: ShopifyMoney | null;
	selectedOptions: ShopifySelectedOption[];
};

export type ShopifyProductOption = {
	name: string;
	values: string[];
};

// Normalized commerce payload for one product — everything the product page
// needs from Shopify, fully serializable so it can cross into client components.
export type ProductCommerce = {
	handle: string;
	availableForSale: boolean;
	/** Online Store product URL (primary domain when published there). */
	url: string;
	minPrice: ShopifyMoney;
	maxPrice: ShopifyMoney;
	options: ShopifyProductOption[];
	variants: ShopifyVariant[];
};

// Lean payload for listing cards: display price + availability only.
export type CardCommerce = {
	handle: string;
	availableForSale: boolean;
	minPrice: ShopifyMoney;
	maxPrice: ShopifyMoney;
};

// Locale → Shopify Markets context. `en` intentionally omits the country so it
// resolves to the store's default market; zh_tw pins the Taiwan market. Adjust
// here (single source of truth) if markets change.
export const LOCALE_SHOPIFY_CONTEXT: Record<
	Locale,
	{ country?: string; language?: string }
> = {
	en: {},
	zh_tw: { country: 'TW', language: 'ZH_TW' },
};

export function shopifyGidToId(gid: string): string {
	return gid.slice(gid.lastIndexOf('/') + 1);
}

/**
 * Formats a Shopify money value for display. Whole amounts drop the fraction
 * (TWD prices read "NT$1,299", not "NT$1,299.00") while fractional amounts
 * keep two digits (USD "$49.99").
 */
export function formatShopifyPrice(
	money: ShopifyMoney,
	locale: Locale
): string {
	const amount = Number(money.amount);
	if (!Number.isFinite(amount)) return '';
	const wholeAmount = amount % 1 === 0;
	try {
		return new Intl.NumberFormat(htmlLangFor(locale), {
			style: 'currency',
			currency: money.currencyCode,
			minimumFractionDigits: 0,
			maximumFractionDigits: wholeAmount ? 0 : 2,
		}).format(amount);
	} catch {
		// Unknown currency code — degrade to a readable raw value.
		return `${money.amount} ${money.currencyCode}`;
	}
}

/**
 * Buy-URL for a specific variant. Shopify's product page preselects the
 * variant from the numeric ?variant= param.
 */
export function shopifyVariantUrl(
	productUrl: string,
	variant?: ShopifyVariant | null
): string {
	if (!variant) return productUrl;
	const sep = productUrl.includes('?') ? '&' : '?';
	return `${productUrl}${sep}variant=${variant.id}`;
}

/**
 * True when the product has no real options — Shopify models "no variants" as
 * a single variant titled "Default Title". Those products render without a
 * variant picker.
 */
export function hasOnlyDefaultVariant(commerce: ProductCommerce): boolean {
	return (
		commerce.variants.length <= 1 &&
		(commerce.options.length === 0 ||
			commerce.options.every(
				(o) => o.values.length <= 1 && o.values[0] === 'Default Title'
			))
	);
}

export function findVariantForSelection(
	variants: ShopifyVariant[],
	selection: Record<string, string>
): ShopifyVariant | null {
	return (
		variants.find((v) =>
			v.selectedOptions.every((o) => selection[o.name] === o.value)
		) ?? null
	);
}

/**
 * Initial picker state: the first available variant, or the first variant at
 * all when everything is sold out (so the sold-out price still shows).
 */
export function pickInitialVariant(
	variants: ShopifyVariant[]
): ShopifyVariant | null {
	return variants.find((v) => v.availableForSale) ?? variants[0] ?? null;
}
