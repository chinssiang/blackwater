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
	minPrice: ShopifyMoney;
	maxPrice: ShopifyMoney;
	options: ShopifyProductOption[];
	variants: ShopifyVariant[];
};

// One line in the shopper's cart, flattened from Shopify's
// `line { merchandise { ...ProductVariant } }` nesting.
export type ShopifyCartLine = {
	/** Cart line id — what cartLinesUpdate/cartLinesRemove address. */
	id: string;
	quantity: number;
	/** Line total (unit price × quantity), already discounted by Shopify. */
	total: ShopifyMoney;
	/**
	 * True when Shopify capped this line at the stock on hand rather than the
	 * quantity we asked for. Only ever set on the response to the mutation that
	 * was capped — the client remembers the ceiling, since a later read has no
	 * way to rediscover it (`quantityAvailable` needs an inventory scope the
	 * Storefront token doesn't have).
	 */
	atStockLimit: boolean;
	merchandise: {
		gid: string;
		/** Variant name, e.g. "M". "Default Title" for option-less products. */
		title: string;
		availableForSale: boolean;
		price: ShopifyMoney;
		imageUrl: string | null;
		imageAlt: string | null;
		productTitle: string;
		productHandle: string;
	};
};

// Serializable cart payload shared between the API route and the client.
export type ShopifyCart = {
	id: string;
	/** Shopify-hosted checkout. The only place the shopper leaves this site. */
	checkoutUrl: string;
	totalQuantity: number;
	subtotal: ShopifyMoney;
	lines: ShopifyCartLine[];
};

/**
 * Ceiling on a single cart line's quantity. Shared so the stepper, the
 * add-to-cart accumulation and the API's validation all agree — enforcing it in
 * only one of them lets a line reach a quantity the others then reject.
 */
export const MAX_LINE_QUANTITY = 99;

/**
 * Shopify's checkout language comes from the URL, not the cart: `buyerIdentity`
 * accepts only a `countryCode`, so a zh_tw shopper whose market resolves to TW
 * would otherwise check out in English. Appending `locale` is the only lever.
 * Shopify falls back to the market's default when the language isn't published,
 * so an unpublished locale degrades rather than erroring.
 */
export function shopifyCheckoutUrl(checkoutUrl: string, locale: Locale): string {
	try {
		const url = new URL(checkoutUrl);
		url.searchParams.set('locale', htmlLangFor(locale));
		return url.toString();
	} catch {
		// Never break the one link that completes a purchase.
		return checkoutUrl;
	}
}

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

// Currencies CLDR renders as a bare "$" in their own locale — correct for a
// local reader, but it reads as USD next to the other locale of the same site
// (zh-TW gives "$1,299" where en gives "NT$1,299"). No `currencyDisplay` value
// produces the disambiguated form in both, so pin the symbol explicitly.
const CURRENCY_SYMBOL_OVERRIDES: Record<string, string> = {
	TWD: 'NT$',
};

/**
 * Formats a Shopify money value for display. Whole amounts drop the fraction
 * (TWD prices read "NT$1,299", not "NT$1,299.00") while fractional amounts
 * keep both digits (USD "$49.90" — min and max must move together, or Intl
 * trims the trailing zero to "$49.9").
 */
export function formatShopifyPrice(
	money: ShopifyMoney,
	locale: Locale
): string {
	const amount = Number(money.amount);
	if (!Number.isFinite(amount)) return '';
	const fractionDigits = amount % 1 === 0 ? 0 : 2;
	try {
		const formatter = new Intl.NumberFormat(htmlLangFor(locale), {
			style: 'currency',
			currency: money.currencyCode,
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits,
		});
		const override = CURRENCY_SYMBOL_OVERRIDES[money.currencyCode];
		if (!override) return formatter.format(amount);
		return formatter
			.formatToParts(amount)
			.map((part) => (part.type === 'currency' ? override : part.value))
			.join('');
	} catch {
		// Unknown currency code — degrade to a readable raw value.
		return `${money.amount} ${money.currencyCode}`;
	}
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
 * Initial picker state: the cheapest available variant, or the first variant
 * at all when everything is sold out (so the sold-out price still shows).
 *
 * Cheapest rather than first-in-position so the opening price agrees with the
 * "From <min>" a listing card derives from `priceRange.minVariantPrice` —
 * position order would let a card advertise a price the page never shows even
 * with nothing sold out. (They still differ when the cheapest variant alone is
 * sold out: the card states the product's floor, the page states what you can
 * actually buy.)
 */
export function pickInitialVariant(
	variants: ShopifyVariant[]
): ShopifyVariant | null {
	const cheapestAvailable = variants
		.filter((v) => v.availableForSale)
		.reduce<ShopifyVariant | null>(
			(cheapest, v) =>
				!cheapest || Number(v.price.amount) < Number(cheapest.price.amount)
					? v
					: cheapest,
			null
		);
	return cheapestAvailable ?? variants[0] ?? null;
}
