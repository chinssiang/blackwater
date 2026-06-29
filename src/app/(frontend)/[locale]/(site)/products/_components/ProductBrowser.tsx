'use client';

import { type ReactNode } from 'react';
import ProductFilters, { type FacetOption } from './ProductFilters';
import ProductGrid, { type ProductCardData } from './ProductGrid';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';

// Raw facet rows as returned by `productFilterFacets` in queries.ts. `count` is the
// contextual count (products yielded given the other active dimensions).
type RawFacet = { value: string | null; label: string | null; count: number };

// Each badge carries its catalogue-wide `baseCount` (does it exist at all) plus the
// contextual `count` (matches under the other active filters).
type BadgeCount = { baseCount: number; count: number };

export type BadgeCounts = {
	'founders-pick': BadgeCount;
	'most-popular': BadgeCount;
	'editors-choice': BadgeCount;
	new: BadgeCount;
};

const BADGE_VALUES = [
	'founders-pick',
	'most-popular',
	'editors-choice',
	'new',
] as const;

export type ProductSelection = {
	categories: string[];
	brands: string[];
	badges: string[];
};

type Props = {
	facetCategories: RawFacet[];
	facetBrands: RawFacet[];
	badgeCounts: BadgeCounts;
	selected: ProductSelection;
	sort: string;
	/** Total products matching the active filters (for the status line). */
	total: number;
	products: ProductCardData[];
	/** Rendered after the results grid — pagination or a "view more" button. */
	footer?: ReactNode;
	/**
	 * Rendered in place of the results when no filters are active (e.g. the index
	 * page's curated showcase). Omit on a plain listing so results always show.
	 */
	showcase?: ReactNode;
	/** Reveal-stagger offset forwarded to the grid. */
	indexOffset?: number;
};

// Categories/brands are existence-filtered server-side, so keep every row (only
// drop malformed ones). A contextual `count` of 0 means "adds nothing under the
// current filters": surfaced as a disabled option, not a hidden one.
function toOptions(rows: RawFacet[]): FacetOption[] {
	return rows
		.filter((r) => r.value)
		.map((r) => ({
			value: r.value as string,
			label: r.label ?? (r.value as string),
			count: r.count,
			disabled: r.count === 0,
		}));
}

/**
 * Shared filterable product listing: the filter toolbar plus either the results
 * grid (with an optional footer) or, when nothing is filtered, an optional
 * showcase. Used by both the products index and the all-products page so the
 * filtering UX lives in one place.
 */
export default function ProductBrowser({
	facetCategories,
	facetBrands,
	badgeCounts,
	selected,
	sort,
	total,
	products,
	footer,
	showcase,
	indexOffset = 0,
}: Props) {
	const t = useTranslations('products');
	const badgeLabels = t.badges as Record<string, string>;
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// Clear the active filter dimensions (keeping sort) and reset pagination.
	// Mirrors ProductFilters' clearAll so the empty-state recovery matches the
	// toolbar's behaviour.
	function clearFilters() {
		const params = new URLSearchParams(searchParams.toString());
		for (const key of ['category', 'brand', 'badge', 'page']) {
			params.delete(key);
		}
		const qs = params.toString();
		router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	}

	const categories = toOptions(facetCategories);
	const brands = toOptions(facetBrands);
	// Show a badge only if it exists catalogue-wide (baseCount); display its
	// contextual count and disable it when nothing matches the current filters.
	const badges: FacetOption[] = BADGE_VALUES.filter(
		(value) => (badgeCounts?.[value]?.baseCount ?? 0) > 0
	).map((value) => {
		const count = badgeCounts?.[value]?.count ?? 0;
		return {
			value,
			label: badgeLabels[value] ?? value,
			count,
			disabled: count === 0,
		};
	});

	const hasActiveFilters =
		selected.categories.length > 0 ||
		selected.brands.length > 0 ||
		selected.badges.length > 0;

	// Show the showcase only when one is provided and neither a filter nor a
	// non-default sort is active; otherwise the grid (or empty state) takes over.
	const showResults = !showcase || hasActiveFilters || sort !== 'az';

	return (
		<>
			<ProductFilters
				categories={categories}
				brands={brands}
				badges={badges}
				selected={selected}
				sort={sort}
				total={total}
			/>

			{showResults ? (
				products.length > 0 ? (
					<>
						<ProductGrid products={products} indexOffset={indexOffset} />
						{footer}
					</>
				) : hasActiveFilters ? (
					<div className="mb-20 flex max-w-[40ch] flex-col items-start gap-4">
						<p className="t-b-1 text-foreground/60">{t.filters.noResults}</p>
						<Button
							variant="outline"
							onClick={clearFilters}
							className="pointer-coarse:min-h-11"
						>
							{t.filters.clearFilters}
						</Button>
					</div>
				) : (
					<p className="t-b-1 mb-20 max-w-[40ch] text-foreground/60">
						{t.filters.emptyCatalogue}
					</p>
				)
			) : (
				showcase
			)}
		</>
	);
}
