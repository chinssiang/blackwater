'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import ProductCategoriesGrid from '../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../_components/ProductPageHeader';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import type { PageProductCategoriesIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageProductCategoriesIndexQueryResult>;
};

export function PageProductCategoriesIndex({ data }: Props) {
	const reveal = useReveal();
	const locale = useLocale();
	const breadcrumb = useTranslations('breadcrumb');
	const t = useTranslations('products');
	const { categories, productCount } = data || {};

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
					{t.categoriesTitle}
				</span>
			</motion.nav>

			<ProductPageHeader
				title={t.categoriesTitle}
				counts={[
					{ count: productCount, forms: t.productCount },
					{ count: categories?.length, forms: t.categoryCount },
				]}
			/>

			<ProductCategoriesGrid
				categories={categories ?? null}
				heading={null}
				priority
			/>
		</>
	);
}
