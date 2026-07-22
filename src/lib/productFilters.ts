// Shared parsing for the product listing filters. Filters travel in the URL as
// comma-separated slugs/values so filtered listings are shareable and crawlable.
// Used by both the products index and the all-products page.

export const PRODUCT_SORT_KEYS = [
	'az',
	'za',
	'newest',
	'oldest',
	'price-asc',
	'price-desc',
] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

// Price filter buckets (New Taiwan Dollars). Single source for the filter UI. The
// same thresholds are mirrored as literals in the GROQ price expression + facet in
// src/sanity/lib/queries.ts (Sanity typegen can't evaluate computed query
// interpolation), so KEEP THE THRESHOLDS IN SYNC with productPriceBucket /
// productFilterFacets there.
export const PRICE_BUCKETS = [
	{ key: 'u1000', min: 0, max: 1000 },
	{ key: '1000-3000', min: 1000, max: 3000 },
	{ key: '3000-7000', min: 3000, max: 7000 },
	{ key: 'o7000', min: 7000, max: null },
] as const;
const PRICE_BUCKET_KEYS: readonly string[] = PRICE_BUCKETS.map((b) => b.key);

export type ProductFilterSearchParams = {
	category?: string;
	brand?: string;
	badge?: string;
	price?: string;
	sort?: string;
};

export type ProductFilters = {
	categories: string[];
	brands: string[];
	badges: string[];
	priceBuckets: string[];
	sort: ProductSortKey;
};

function parseList(value?: string): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

export function parseProductFilters(
	searchParams: ProductFilterSearchParams
): ProductFilters {
	const sort = searchParams.sort as ProductSortKey;
	return {
		categories: parseList(searchParams.category),
		brands: parseList(searchParams.brand),
		badges: parseList(searchParams.badge),
		// Keep only recognized bucket keys so a stale or hand-edited URL can't inject junk.
		priceBuckets: parseList(searchParams.price).filter((k) =>
			PRICE_BUCKET_KEYS.includes(k)
		),
		sort: PRODUCT_SORT_KEYS.includes(sort) ? sort : 'az',
	};
}
