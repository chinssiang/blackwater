'use client';

import { type ReactNode } from 'react';
import { PRODUCT_BADGE_OPTIONS, badgeLabel } from '@/lib/product-badges';
import {
	PRICE_BUCKETS,
	type ProductFilterSelection,
	countActiveFilters,
} from '@/lib/productFilters';
import { cn } from '@/lib/utils';
import { useProductFilterParams } from '@/hooks/useProductFilterParams';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui/Button';
import ProductFilters, { type FacetOption } from './ProductFilters';
import ProductGrid, { type ProductCardData } from './ProductGrid';
import type { ProductFilterFacetsQueryResult } from 'sanity.types';

// The facet shapes come from the generated query result, not a hand-written
// copy: adding a facet field or renaming a bucket then moves these with it
// instead of leaving a parallel type that still compiles against the old shape.
type Facets = ProductFilterFacetsQueryResult;

// `count` is the contextual count -- products this option would yield given the
// OTHER active dimensions.
type RawFacet = Facets['facetBrands'][number];

// Categories arrive as the SAME rows the bottom category grid renders, carrying
// both numbers: `count` is catalogue-wide (the grid's own label, and what
// decides whether the category is offered as a filter at all) and
// `contextualCount` is the facet count. They are not projected twice -- see the
// note above productCategoriesFacetFields in queries.ts.
type CategoryRow = Facets['categories'][number];

// Each badge carries its catalogue-wide `baseCount` (does it exist at all) plus
// the contextual `count` (matches under the other active filters).
export type BadgeCounts = Facets['badgeCounts'];

// Contextual product counts per price bucket (keys match PRICE_BUCKETS).
export type PriceCounts = Facets['facetPrice'];

// PRODUCT_BADGE_OPTIONS, not a local list: that module is the one declaration of
// the badge vocabulary (it also drives the Studio picker and the card ordering),
// and its `satisfies` clause is what makes a badge without a dictionary label a
// build error. A separate array here meant a fifth badge could be counted by the
// query and never offered in the drawer, with nothing failing. Reading it also
// puts the filter list in the documented priority order.
const BADGE_VALUES = PRODUCT_BADGE_OPTIONS.map((option) => option.value);

/** Re-exported so the page and PageProductsAll name it where they use it. */
export type ProductSelection = ProductFilterSelection;

type Props = {
	categories: CategoryRow[];
	facetBrands: RawFacet[];
	// Optional: the facets are their own query, so a failed fetch degrades to a
	// listing with no badge/price options rather than taking the page down.
	badgeCounts?: BadgeCounts;
	facetPrice?: PriceCounts;
	selected: ProductSelection;
	sort: string;
	products: ProductCardData[];
	/** Rendered after the results grid — pagination or a "view more" button. */
	footer?: ReactNode;
	/** Applied to the results grid (gutter + bottom spacing from the host page). */
	gridClassName?: string;
	/** Applied to the toolbar and the empty states, which sit outside the grid. */
	className?: string;
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

// The category rows' own existence filter, done here rather than as a second
// GROQ selection: `count > 0` is exactly the sub-query the grid already pays
// for. Ordering is the query's.
function toCategoryOptions(rows: CategoryRow[]): FacetOption[] {
	return rows
		.filter((r) => r.slug && r.count > 0)
		.map((r) => ({
			value: r.slug as string,
			label: r.title ?? (r.slug as string),
			count: r.contextualCount,
			disabled: r.contextualCount === 0,
		}));
}

/**
 * The filterable product listing: filter toolbar, results grid, optional footer.
 *
 * Used by /products/all only. /products is prerendered per locale and reads no
 * searchParams, so it has no filter state to render — see the note on the filter
 * fragments in queries.ts.
 */
export default function ProductBrowser({
	categories: categoryRows,
	facetBrands,
	badgeCounts,
	facetPrice,
	selected,
	sort,
	products,
	footer,
	gridClassName,
	className,
	indexOffset = 0,
}: Props) {
	const t = useTranslations('products');
	const badgeLabels = t.badges as Record<string, string>;
	// The same writer the toolbar uses, so this recovery and the toolbar's own
	// "clear filters" cannot drift on which params they drop.
	const { clearAll, isPending } = useProductFilterParams();

	const categories = toCategoryOptions(categoryRows);
	const brands = toOptions(facetBrands);
	// Show a badge only if it exists catalogue-wide (baseCount); display its
	// contextual count and disable it when nothing matches the current filters.
	const badges: FacetOption[] = BADGE_VALUES.filter(
		(value) => (badgeCounts?.[value]?.baseCount ?? 0) > 0
	).map((value) => {
		const count = badgeCounts?.[value]?.count ?? 0;
		return {
			value,
			label: badgeLabel(value, badgeLabels),
			count,
			disabled: count === 0,
		};
	});

	// Price buckets are fixed ranges (always offered); disabled when nothing in the
	// range matches the other active filters. Labels come from the dictionary.
	const priceLabels =
		(t.filters as unknown as { priceBuckets?: Record<string, string> })
			.priceBuckets ?? {};
	const prices: FacetOption[] = PRICE_BUCKETS.map((bucket) => {
		const count = facetPrice?.[bucket.key] ?? 0;
		return {
			value: bucket.key,
			label: priceLabels[bucket.key] ?? bucket.key,
			count,
			disabled: count === 0,
		};
	});

	// `sort` deliberately not counted: a reordered listing is still the whole
	// listing, so the "no results, clear your filters" recovery does not apply.
	const hasActiveFilters = countActiveFilters(selected) > 0;

	return (
		<>
			<div className={className}>
				<ProductFilters
					categories={categories}
					brands={brands}
					badges={badges}
					prices={prices}
					selected={selected}
					sort={sort}
				/>
			</div>

			{products.length > 0 ? (
				<>
					<ProductGrid
						products={products}
						indexOffset={indexOffset}
						className={gridClassName}
					/>
					{footer}
				</>
			) : hasActiveFilters ? (
				<div
					className={cn(
						'mb-20 flex max-w-[40ch] flex-col items-start gap-4',
						className
					)}
				>
					<p className="t-b-1 text-foreground/60">{t.filters.noResults}</p>
					<Button
						variant="outline"
						onClick={clearAll}
						disabled={isPending}
						className="pointer-coarse:min-h-11"
					>
						{t.filters.clearFilters}
					</Button>
				</div>
			) : (
				<p
					className={cn(
						't-b-1 text-foreground/60 mb-20 max-w-[40ch]',
						className
					)}
				>
					{t.emptyAllProducts}
				</p>
			)}
		</>
	);
}
