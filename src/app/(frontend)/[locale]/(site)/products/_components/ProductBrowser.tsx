'use client';

import { type ReactNode } from 'react';
import ProductFilters, { type FacetOption } from './ProductFilters';
import ProductGrid, { type ProductCardData } from './ProductGrid';
import { useTranslations } from '@/components/LocaleProvider';

// Raw facet rows as returned by `productFilterFacets` in queries.ts.
type RawFacet = { value: string | null; label: string | null; count: number };

export type BadgeCounts = {
	'founders-pick': number;
	'most-popular': number;
	'editors-choice': number;
	new: number;
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

// Drop empty/uncounted rows and coerce to the FacetOption shape the toolbar wants.
function toOptions(rows: RawFacet[]): FacetOption[] {
	return rows
		.filter((r) => r.value && r.count > 0)
		.map((r) => ({
			value: r.value as string,
			label: r.label ?? (r.value as string),
			count: r.count,
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
	products,
	footer,
	showcase,
	indexOffset = 0,
}: Props) {
	const t = useTranslations('products');
	const badgeLabels = t.badges as Record<string, string>;

	const categories = toOptions(facetCategories);
	const brands = toOptions(facetBrands);
	const badges: FacetOption[] = BADGE_VALUES.map((value) => ({
		value,
		label: badgeLabels[value] ?? value,
		count: badgeCounts?.[value] ?? 0,
	})).filter((b) => b.count > 0);

	const hasActiveFilters =
		selected.categories.length > 0 ||
		selected.brands.length > 0 ||
		selected.badges.length > 0;

	// Show the showcase only when one is provided and no filter is active;
	// otherwise the grid (or empty state) takes over.
	const showResults = !showcase || hasActiveFilters;

	return (
		<>
			<ProductFilters
				categories={categories}
				brands={brands}
				badges={badges}
				selected={selected}
				sort={sort}
			/>

			{showResults ? (
				products.length > 0 ? (
					<>
						<ProductGrid products={products} indexOffset={indexOffset} />
						{footer}
					</>
				) : (
					<p className="t-b-1 mb-20 max-w-[40ch] text-foreground/60">
						{hasActiveFilters
							? t.filters.noResults
							: 'Nothing here yet. Picks are added as the club vets new gear.'}
					</p>
				)
			) : (
				showcase
			)}
		</>
	);
}
