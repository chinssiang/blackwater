'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import CustomPortableText from '@/components/CustomPortableText';
import { fadeAnim } from '@/lib/animate';
import { motion } from 'motion/react';
import type { PageCuratedSingleQueryResult } from 'sanity.types';
import { hasArrayValue } from '@/lib/utils';
import CuratedProductCard from '../../../_components/CuratedProductCard';

type Props = {
	data: NonNullable<PageCuratedSingleQueryResult>;
};

const reveal = {
	initial: 'hide',
	animate: 'show',
	variants: fadeAnim,
} as const;

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
		? categories
				.map((c: any) => c.title)
				.filter(Boolean)
				.join(', ')
		: null;
	const brandLabel = hasArrayValue(brands)
		? (brands as any[])
				.map((b: any) => b.title)
				.filter(Boolean)
				.join(', ')
		: null;

	const firstCategory = hasArrayValue(categories)
		? (categories[0] as any)
		: null;
	// Keep the eyebrow concise: lead with the brand (the key identifier) and
	// let the breadcrumb carry the category. Products can be tagged with many
	// categories, so listing them all here reads as noise.
	const eyebrow = brandLabel || categoryLabel;

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
					className="transition-colors hover:text-foreground"
				>
					Curated
				</Link>
				{firstCategory?.slug && (
					<>
						<span aria-hidden className="text-foreground/30">
							/
						</span>
						<Link
							href={`/curated/categories/${firstCategory.slug}`}
							className="transition-colors hover:text-foreground"
						>
							{firstCategory.title}
						</Link>
					</>
				)}
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<span className="text-foreground/90">{title}</span>
			</motion.nav>

			{/* Product hero */}
			<div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 mb-16 lg:mb-24">
				{/* Image */}
				<motion.div
					className="relative aspect-4/3 overflow-hidden p-6 lg:col-span-7 lg:p-10"
					{...reveal}
					transition={{ duration: 0.8, delay: 0.05, ease: [0, 0.5, 0.5, 1] }}
				>
					{mainImage ? (
						<ImageBlock
							fill="contain"
							imageObj={mainImage as any}
							alt={title ?? ''}
							sizes="(max-width: 1024px) 100vw, 58vw"
							priority
						/>
					) : (
						<div className="absolute inset-0 bg-foreground/10" />
					)}
				</motion.div>

				{/* Details */}
				<div className="flex flex-col lg:col-span-5 lg:pt-2">
					{eyebrow && (
						<motion.p
							className="t-b-2 uppercase tracking-[0.04em] text-foreground/65"
							{...reveal}
							transition={{
								duration: 0.6,
								delay: 0.1,
								ease: [0, 0.71, 0.2, 1.01],
							}}
						>
							{eyebrow}
						</motion.p>
					)}

					<motion.h1
						className="uppercase tracking-[-0.02em] leading-[1.05] text-[clamp(1.5rem,2.6vw,2.125rem)] mt-3"
						{...reveal}
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
							className="t-h-3 uppercase text-foreground/85 mt-4"
							{...reveal}
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
							className="mt-6"
							{...reveal}
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
								className="inline-flex w-full items-center justify-center bg-foreground text-background t-b-1 uppercase px-10 py-4 transition-colors hover:bg-foreground/85 sm:w-auto"
							>
								Buy Now
							</a>
						</motion.div>
					)}

					{/* Content (Information / What We Like) */}
					{content && content.length > 0 && (
						<motion.div
							className="mt-10 max-w-[60ch] border-t border-foreground/10 pt-8 text-[0.9375rem] leading-relaxed text-foreground/80 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-medium [&_h2]:uppercase [&_h2]:tracking-[-0.02em] [&_h2]:text-foreground [&_h2:first-child]:mt-0 [&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:uppercase [&_h3]:text-foreground [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
							{...reveal}
							transition={{
								duration: 0.8,
								delay: 0.3,
								ease: [0, 0.5, 0.5, 1],
							}}
						>
							<CustomPortableText blocks={content as any} />
						</motion.div>
					)}
				</div>
			</div>

			{/* Related products */}
			{displayRelated && displayRelated.length > 0 && (
				<section className="border-t border-foreground/10 pt-12 lg:pt-16">
					<div className="mb-6 flex items-baseline justify-between gap-4 lg:mb-8">
						<h2 className="t-l-2 uppercase text-foreground/70">
							{firstCategory?.title
								? `More ${firstCategory.title}`
								: 'More picks'}
						</h2>
						<Link
							href="/curated/products"
							className="t-l-2 uppercase text-foreground/75 transition-colors hover:text-foreground"
						>
							All products →
						</Link>
					</div>
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{displayRelated.map((product, index) => (
							<CuratedProductCard
								key={product._id}
								product={product}
								index={index}
							/>
						))}
					</div>
				</section>
			)}
		</div>
	);
}
