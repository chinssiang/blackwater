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

// The order the listing falls back to, and the one value that is NOT written to
// the URL. Named rather than spelled 'az' at each site: the parser's fallback,
// the sort control's "drop the param" rule and the is-this-filtered test below
// all mean the same thing by it.
export const DEFAULT_PRODUCT_SORT: ProductSortKey = 'az';

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

// Comfortably above any real selection (the catalogue has tens of brands, a
// dozen categories, four badges and four price buckets), and low enough that a
// hand-crafted URL cannot turn one request into an arbitrarily large GROQ `in`
// list. Over the cap the extra values are dropped, not the whole request: a
// truncated filter still returns a sane page.
//
// It bounds each list's LENGTH, not the number of distinct cache keys reachable
// from crafted URLs -- `?brand=junk1`, `?brand=junk2`, ... each still mint one.
// Only `price` is immune, because its allowlist below makes its value space
// finite. Closing that for category/brand means validating against the real
// slug set, which is a second (filter-independent, shareable) query rather than
// a constant; not done, deliberately.
const MAX_FILTER_VALUES = 50;

// Deduped as well as trimmed. A repeated value changes nothing about what GROQ
// matches, but `["a","a"]` and `["a"]` are different cache keys and different
// chips in the toolbar, so the URL is normalized once here rather than in each
// consumer.
function parseList(value?: string): string[] {
	if (!value) return [];
	const seen = new Set<string>();
	for (const part of value.split(',')) {
		const trimmed = part.trim();
		if (trimmed) seen.add(trimmed);
		if (seen.size >= MAX_FILTER_VALUES) break;
	}
	return [...seen];
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
		sort: PRODUCT_SORT_KEYS.includes(sort) ? sort : DEFAULT_PRODUCT_SORT,
	};
}

/** The four dimensions without the sort — what the UI calls a "selection". */
export type ProductFilterSelection = Omit<ProductFilters, 'sort'>;

/** How many filter values are active across all four dimensions. */
export function countActiveFilters(selection: ProductFilterSelection): number {
	return (
		selection.categories.length +
		selection.brands.length +
		selection.badges.length +
		selection.priceBuckets.length
	);
}

/**
 * Whether this view is a slice of the listing rather than the listing itself.
 *
 * Beside the parser because three places ask it and would each have spelled it
 * out: the toolbar's active-chip row, the empty state's "clear filters"
 * recovery, and generateMetadata's de-index rule -- where getting it wrong
 * means indexing an unbounded filtered crawl space. A non-default sort counts:
 * it reorders the same set, but the URL is still not the canonical one.
 */
export function isProductFilterActive(filters: ProductFilters): boolean {
	return (
		countActiveFilters(filters) > 0 || filters.sort !== DEFAULT_PRODUCT_SORT
	);
}
