'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import CuratedProductCard from '../../../_components/CuratedProductCard';
import CuratedPageHeader from '../../../_components/CuratedPageHeader';
import { useReveal } from '@/hooks/useReveal';
import type { PageCuratedCategorySingleQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCategorySingleQueryResult>;
};

export default function PageCuratedCategory({ data }: Props) {
	const reveal = useReveal();
	const { title, products } = data || {};

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
				kicker="Category"
				title={title}
				counts={[{ count: products?.length, unit: 'product' }]}
			/>

			{products && products.length > 0 ? (
				<div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
					{products.map((product, index) => (
						<CuratedProductCard
							key={product._id}
							product={product}
							index={index}
						/>
					))}
				</div>
			) : (
				<p className="t-b-1 max-w-[40ch] text-foreground/60">
					No picks in this category yet. Check back as the shelf grows.
				</p>
			)}
		</div>
	);
}
