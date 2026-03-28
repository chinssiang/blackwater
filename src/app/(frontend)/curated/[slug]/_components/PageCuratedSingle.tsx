'use client';

import React from 'react';
import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import CustomPortableText from '@/components/CustomPortableText';
import { fadeAnim } from '@/lib/animate';
import { motion } from 'motion/react';
import type { PageCuratedSingleQueryResult } from 'sanity.types';
import { hasArrayValue } from '@/lib/utils';
import CuratedProductCard from '../../_components/CuratedProductCard';
import CuratedCategoriesGrid from '../../_components/CuratedCategoriesGrid';

type Props = {
	data: NonNullable<PageCuratedSingleQueryResult>;
};

export default function PageCuratedSingle({ data }: Props) {
	const {
		title,
		categories,
		brands,
		mainImage,
		price,
		purchaseLink,
		content,
		relatedProducts,
		defaultRelatedProducts,
	} = data || {};

	const displayRelated =
		relatedProducts && relatedProducts.length > 0
			? relatedProducts
			: defaultRelatedProducts;

	const categoryLabel = hasArrayValue(categories)
		? categories.map((c: any) => c.title).filter(Boolean).join(', ')
		: null;
	const brandLabel = hasArrayValue(brands)
		? (brands as any[]).map((b: any) => b.title).filter(Boolean).join(', ')
		: null;

	const firstCategoryTitle = hasArrayValue(categories)
		? (categories[0] as any).title
		: null;

	return (
		<div className="min-h-[inherit]">
			<div className="px-contain mx-auto py-10 lg:py-17.5">
				{/* Product hero */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-16 lg:mb-24">
					{/* Image */}
					<motion.div
						className="relative aspect-4/3 overflow-hidden bg-foreground"
						initial="hide"
						animate="show"
						variants={fadeAnim}
						transition={{
							duration: 0.8,
							delay: 0.05,
							ease: [0, 0.5, 0.5, 1],
						}}
					>
						{mainImage ? (
							<ImageBlock
								fill="contain"
								imageObj={mainImage as any}
								alt={title ?? ''}
								priority
							/>
						) : (
							<div className="w-full h-full bg-foreground" />
						)}
					</motion.div>

					{/* Details */}
					<div className="flex flex-col gap-4 justify-center">
						{/* Category → Brand */}
						{(categoryLabel || brandLabel) && (
							<motion.p
								className="t-h-6 uppercase text-muted"
								initial="hide"
								animate="show"
								variants={fadeAnim}
								transition={{
									duration: 0.6,
									delay: 0.1,
									ease: [0, 0.71, 0.2, 1.01],
								}}
							>
								{[categoryLabel, brandLabel]
									.filter(Boolean)
									.join(' \u2014 ')}
							</motion.p>
						)}

						<motion.h1
							className="t-h-2 uppercase"
							initial="hide"
							animate="show"
							variants={fadeAnim}
							transition={{
								duration: 0.8,
								delay: 0.15,
								ease: [0, 0.71, 0.2, 1.01],
							}}
						>
							{title}
						</motion.h1>

						{price && (
							<motion.p
								className="t-h-4 uppercase"
								initial="hide"
								animate="show"
								variants={fadeAnim}
								transition={{
									duration: 0.6,
									delay: 0.2,
									ease: [0, 0.71, 0.2, 1.01],
								}}
							>
								{price}
							</motion.p>
						)}

						{purchaseLink && (
							<motion.div
								initial="hide"
								animate="show"
								variants={fadeAnim}
								transition={{
									duration: 0.6,
									delay: 0.25,
									ease: [0, 0.71, 0.2, 1.01],
								}}
							>
								<a
									href={purchaseLink}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center justify-center w-full bg-foreground text-background t-h-6 uppercase py-3.5 hover:bg-foreground/80 transition-colors"
								>
									Buy Now
								</a>
							</motion.div>
						)}

						{/* Content (Information / What We Like) */}
						{content && content.length > 0 && (
							<motion.div
								className="mt-4"
								initial="hide"
								animate="show"
								variants={fadeAnim}
								transition={{
									duration: 0.8,
									delay: 0.3,
									ease: [0, 0.5, 0.5, 1],
								}}
							>
								<CustomPortableText blocks={content as any} />
							</motion.div>
						)}

						{/* Back link */}
						<motion.div
							initial="hide"
							animate="show"
							variants={fadeAnim}
							transition={{
								duration: 0.6,
								delay: 0.35,
								ease: [0, 0.71, 0.2, 1.01],
							}}
						>
							<Link
								href="/curated"
								className="t-h-6 uppercase text-muted hover:text-foreground transition-colors inline-flex items-center gap-1"
							>
								← Back
							</Link>
						</motion.div>
					</div>
				</div>

				{/* Related products */}
				{displayRelated && displayRelated.length > 0 && (
					<div className="mb-16 lg:mb-24">
						<div className="flex items-baseline justify-between mb-6">
							<p className="t-h-5 uppercase text-muted">
								{firstCategoryTitle
									? `More ${firstCategoryTitle}`
									: 'More Picks'}
							</p>
							{displayRelated.some(
								(p: any) => p.badge === "Founder's Pick"
							) && (
								<p className="t-h-6 uppercase text-muted">
									Founder&apos;s Picks
								</p>
							)}
						</div>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
							{displayRelated.map((product, index) => (
								<CuratedProductCard
									key={product._id}
									product={product}
									index={index}
								/>
							))}
						</div>
						<div className="flex justify-center">
							<Link
								href="/curated"
								className="inline-flex items-center justify-center bg-foreground text-background t-h-6 uppercase px-12 py-3 hover:bg-foreground/80 transition-colors"
							>
								View All
							</Link>
						</div>
					</div>
				)}

				{/* Categories section */}
				<CuratedCategoriesGrid
					categories={(data as any).categories ?? null}
					showViewAll
				/>
			</div>
		</div>
	);
}
