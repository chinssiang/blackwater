'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import ProductCard from '../../_components/ProductCard';
import ProductCategoriesGrid from '../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../_components/ProductPageHeader';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import type { PageProductsAllQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageProductsAllQueryResult>;
};

export function PageProductsAll({ data }: Props) {
	const reveal = useReveal();
	const locale = useLocale();
	const breadcrumb = useTranslations('breadcrumb');
	const t = useTranslations('products');
	const { products, categories } = data || {};

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
				counts={[{ count: products?.length, forms: t.productCount }]}
			/>

			{products && products.length > 0 ? (
				<div className="mb-20 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
					{products.map((product, index) => (
						<ProductCard key={product._id} product={product} index={index} />
					))}
				</div>
			) : (
				<p className="t-b-1 max-w-[40ch] text-foreground/60">
					Nothing here yet. Picks are added as the club vets new gear.
				</p>
			)}

			{categories && categories.length > 0 && (
				<div className="border-t border-foreground/10 pt-12 lg:pt-16">
					<ProductCategoriesGrid categories={categories} />
				</div>
			)}
		</>
	);
}
