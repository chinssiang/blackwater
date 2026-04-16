'use client';

import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';
import CuratedProductCard from '../../../_components/CuratedProductCard';
import CuratedCategoriesGrid from '../../../_components/CuratedCategoriesGrid';
import type { PageCuratedCollectionSingleQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCollectionSingleQueryResult>;
};

export default function PageCuratedCollection({ data }: Props) {
	const { title, description, products, categories } = data || {};

	return (
		<div className="px-contain mx-auto min-h-[inherit] py-10 lg:py-17.5">
			{/* Header */}
			<motion.div
				className="mb-10 lg:mb-17.5"
				initial="hide"
				animate="show"
				variants={fadeAnim}
				transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
			>
				<h1 className="t-h-2 uppercase">{title}</h1>
				{description && (
					<p className="t-b-1 mt-3 text-muted">{description}</p>
				)}
			</motion.div>

			{/* Product grid */}
			{products && products.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16 lg:mb-24">
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
			<CuratedCategoriesGrid
				categories={categories ?? null}
				showViewAll
			/>
		</div>
	);
}
