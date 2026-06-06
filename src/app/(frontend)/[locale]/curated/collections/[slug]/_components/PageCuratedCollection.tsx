'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import CuratedProductCard from '../../../_components/CuratedProductCard';
import CuratedCategoriesGrid from '../../../_components/CuratedCategoriesGrid';
import CuratedPageHeader from '../../../_components/CuratedPageHeader';
import { useReveal } from '@/hooks/useReveal';
import type { PageCuratedCollectionSingleQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCollectionSingleQueryResult>;
};

export default function PageCuratedCollection({ data }: Props) {
	const reveal = useReveal();
	const { title, description, products, categories } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			{/* Breadcrumb */}
			<motion.nav
				aria-label="Breadcrumb"
				className="t-l-2 uppercase text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 lg:mb-16"
				{...reveal}
				transition={{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }}
			>
				<Link
					href="/curated"
					className="inline-flex items-center transition-colors hover:text-foreground pointer-coarse:min-h-11"
				>
					Curated
				</Link>
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<span aria-current="page" className="text-foreground/90">
					{title}
				</span>
			</motion.nav>

			<CuratedPageHeader
				kicker="Collection"
				title={title}
				counts={[{ count: products?.length, unit: 'product' }]}
				lede={description}
			/>

			{/* Product grid */}
			{products && products.length > 0 && (
				<div className="mb-20 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 xl:grid-cols-4 2xl:gap-x-10">
					{products.map((product, index) => (
						<CuratedProductCard
							key={product._id}
							product={product}
							index={index}
						/>
					))}
				</div>
			)}

			{/* Categories section */}
			{categories && categories.length > 0 && (
				<div className="border-t border-foreground/10 pt-12 lg:pt-16">
					<CuratedCategoriesGrid categories={categories} showViewAll />
				</div>
			)}
		</div>
	);
}
