'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import ProductCategoriesGrid from '../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../_components/ProductPageHeader';
import ProductBrowser, {
	type ProductSelection,
} from '../../_components/ProductBrowser';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { localizePath } from '@/lib/i18n';
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/Pagination';
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
	const reveal = useReveal();
	const locale = useLocale();
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const breadcrumb = useTranslations('breadcrumb');
	const t = useTranslations('products');
	const common = useTranslations('common');
	const { products, categories, facetCategories, facetBrands, badgeCounts } =
		data || {};

	// Pagination links keep the current filter/sort params and only swap `page`.
	const hrefFor = (p: number) => {
		const params = new URLSearchParams(searchParams.toString());
		if (p > 1) params.set('page', String(p));
		else params.delete('page');
		const qs = params.toString();
		return pathname + (qs ? `?${qs}` : '');
	};

	const pagination = totalPages > 1 && (
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
							<PaginationLink href={hrefFor(p)} isActive={p === currentPage}>
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
	);

	return (
		<>
			{/* Breadcrumb */}
			<motion.nav
				aria-label="Breadcrumb"
				className="t-l-2 uppercase text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 lg:mb-16"
				{...reveal}
				transition={{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }}
			>
				<Link
					href={resolveHref({ documentType: 'pProductIndex', locale })!}
					className="inline-flex items-center transition-colors hover:text-foreground pointer-coarse:min-h-11"
				>
					{breadcrumb.products}
				</Link>
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<span aria-current="page" className="text-foreground/90">
					{t.allProducts}
				</span>
			</motion.nav>

			<ProductPageHeader
				title={t.allProducts}
				counts={[{ count: total, forms: t.productCount }]}
			/>

			<ProductBrowser
				facetCategories={facetCategories ?? []}
				facetBrands={facetBrands ?? []}
				badgeCounts={badgeCounts}
				selected={selected}
				sort={sort}
				total={total}
				products={products ?? []}
				footer={pagination}
			/>

			{categories && categories.length > 0 && (
				<div className="border-t border-foreground/10 pt-12 lg:pt-16">
					<ProductCategoriesGrid categories={categories} />
				</div>
			)}
		</>
	);
}
