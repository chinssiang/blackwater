'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';
import CuratedProductCard from './CuratedProductCard';
import CuratedCategoriesGrid from './CuratedCategoriesGrid';
import type { PageCuratedIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedIndexQueryResult>;
};

export function PageCuratedIndex({ data }: Props) {
	console.log('🚀 ~ :16 ~ PageCuratedIndex ~ data:', data);
	const { title, description, collections, categories } = data || {};

	return (
		<>
			<motion.section
				className="bg-background text-foreground px-contain py-20 lg:py-32 flex items-center justify-center text-center"
				initial="hide"
				animate="show"
				variants={fadeAnim}
				transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
			>
				{title && <h1 className="t-h-4 uppercase">{title}</h1>}
				{description && (
					<p className="t-h-5 uppercase max-w-3xl">{description}</p>
				)}
			</motion.section>
			<section className="px-contain mx-auto py-10 lg:py-17.5 bg-white text-black">
				<div className="mb-16 lg:mb-24">
					<CuratedCategoriesGrid categories={categories ?? null} priority />
				</div>
				{collections &&
					collections.map((collection, collectionIndex) => (
						<motion.section
							key={collection._id}
							className="mb-16 lg:mb-24"
							initial="hide"
							animate="show"
							variants={fadeAnim}
							transition={{
								duration: 0.8,
								delay: collectionIndex * 0.1,
								ease: [0, 0.5, 0.5, 1],
							}}
						>
							{/* Collection header */}
							<div className="mb-6">
								<h2 className="t-h-5 uppercase">{collection.title}</h2>
								{collection.description && (
									<p className="t-b-2 text-muted mt-1">
										{collection.description}
									</p>
								)}
							</div>

							{/* Product grid */}
							{collection.products && collection.products.length > 0 && (
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
									{collection.products.map((product, index) => (
										<CuratedProductCard
											key={product._id}
											product={product}
											index={index}
										/>
									))}
								</div>
							)}
							{collection.slug && (
								<div className="flex justify-center">
									<Button asChild>
										<Link href={`/curated/collection/${collection.slug}`}>
											View All
										</Link>
									</Button>
								</div>
							)}
						</motion.section>
					))}
			</section>
		</>
	);
}
