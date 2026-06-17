// Shared parsing for the product listing filters. Filters travel in the URL as
// comma-separated slugs/values so filtered listings are shareable and crawlable.
// Used by both the products index and the all-products page.

export const PRODUCT_SORT_KEYS = ['az', 'za', 'newest', 'oldest'] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export type ProductFilterSearchParams = {
	category?: string;
	brand?: string;
	badge?: string;
	sort?: string;
};

export type ProductFilters = {
	categories: string[];
	brands: string[];
	badges: string[];
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
		sort: PRODUCT_SORT_KEYS.includes(sort) ? sort : 'az',
	};
}
