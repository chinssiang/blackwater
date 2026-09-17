'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolveHref } from '@/lib/routes';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/Pagination';
import ProductBrowser, {
	type ProductSelection,
} from '../../_components/ProductBrowser';
import ProductCategoriesGrid from '../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../_components/ProductPageHeader';
import type { PageProductsAllQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageProductsAllQueryResult>;
	currentPage: number;
	totalPages: number;
	total: number;
	selected: ProductSelection;
	sort: string;
};

/**
 * Page numbers to show, with 'ellipsis' markers: always first + last page and
 * a ±1 window around the current page. e.g. [1, 'ellipsis', 4, 5, 6, 'ellipsis', 12].
 */
function getPageRange(
	current: number,
	total: number
): Array<number | 'ellipsis'> {
	if (total <= 7) {
		return Array.from({ length: total }, (_, i) => i + 1);
	}

	const pages = new Set<number>([1, total, current - 1, current, current + 1]);
	const sorted = [...pages]
		.filter((p) => p >= 1 && p <= total)
		.sort((a, b) => a - b);

	const range: Array<number | 'ellipsis'> = [];
	let prev = 0;
	for (const p of sorted) {
		if (p - prev > 1) range.push('ellipsis');
		range.push(p);
		prev = p;
	}
	return range;
}

export function PageProductsAll({
	data,
	currentPage,
	totalPages,
	total,
	selected,
	sort,
}: Props) {
	const locale = useLocale();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const breadcrumb = useTranslations('breadcrumb');
	const t = useTranslations('products');
	const common = useTranslations('common');
	const {
		products,
		categories,
		facetCategories,
		facetBrands,
		badgeCounts,
		facetPrice,
	} = data || {};

	// Pagination links keep whatever filter/sort params are active and swap only
	// `page`, so paging never silently drops the filter the shopper is browsing.
	const hrefFor = (p: number) => {
		const params = new URLSearchParams(searchParams.toString());
		if (p > 1) params.set('page', String(p));
		else params.delete('page');
		const qs = params.toString();
		return pathname + (qs ? `?${qs}` : '');
	};

	return (
		<>
			{/* Breadcrumb */}
			<nav
				aria-label="Breadcrumb"
				className="m-x-max reveal t-l-2 text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 uppercase lg:mb-16"
			>
				<Link
					href={resolveHref({ documentType: 'pProductIndex', locale })!}
					className="hover:text-foreground inline-flex items-center transition-colors pointer-coarse:min-h-11"
				>
					{breadcrumb.products}
				</Link>
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<span aria-current="page" className="text-foreground/90">
					{t.allProducts}
				</span>
			</nav>

			<ProductPageHeader
				title={t.allProducts}
				counts={[{ count: total, forms: t.productCount }]}
			/>

			{/* The pagination below is the one top-level section here with no
			    `m-x-max`, deliberately: Pagination is `mx-auto w-full` with centred
			    content, so it spans the window but its links stay centred on the same
			    axis the gutter would have centred them on. Adding the gutter means
			    fighting both of those classes — `m-x-max` loses the cascade to
			    `mx-auto` (a custom @utility sorts before Tailwind's own), and a margin
			    plus `w-full` overflows the viewport by the gutter's width. So it is
			    passed as ProductBrowser's `footer`, outside the gutter, while the
			    toolbar and grid take `m-x-max` through `className`/`gridClassName`. */}
			<ProductBrowser
				facetCategories={facetCategories ?? []}
				facetBrands={facetBrands ?? []}
				badgeCounts={badgeCounts}
				facetPrice={facetPrice}
				selected={selected}
				sort={sort}
				total={total}
				// The page header above already prints the count.
				showCount={false}
				products={products ?? []}
				className="m-x-max"
				gridClassName="m-x-max mb-20"
				footer={
					totalPages > 1 && (
						<Pagination className="mb-20">
							<PaginationContent>
								{currentPage > 1 && (
									<PaginationItem>
										<PaginationPrevious
											href={hrefFor(currentPage - 1)}
											text={common.previous}
										/>
									</PaginationItem>
								)}

								{getPageRange(currentPage, totalPages).map((p, i) =>
									p === 'ellipsis' ? (
										<PaginationItem key={`ellipsis-${i}`}>
											<PaginationEllipsis />
										</PaginationItem>
									) : (
										<PaginationItem key={p}>
											<PaginationLink
												href={hrefFor(p)}
												isActive={p === currentPage}
											>
												{p}
											</PaginationLink>
										</PaginationItem>
									)
								)}

								{currentPage < totalPages && (
									<PaginationItem>
										<PaginationNext
											href={hrefFor(currentPage + 1)}
											text={common.next}
										/>
									</PaginationItem>
								)}
							</PaginationContent>
						</Pagination>
					)
				}
			/>

			{categories && categories.length > 0 && (
				<div className="m-x-max border-foreground/10 border-t pt-12 lg:pt-16">
					<ProductCategoriesGrid categories={categories} />
				</div>
			)}
		</>
	);
}
