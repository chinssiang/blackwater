'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';
import ImageBlock from '@/components/ImageBlock';
import CuratedProductCard from './CuratedProductCard';
import CuratedCategoriesGrid from './CuratedCategoriesGrid';
import type { PageCuratedIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedIndexQueryResult>;
};

type Collection = NonNullable<
	NonNullable<PageCuratedIndexQueryResult>['collections']
>[number];

function CollectionMasthead({
	collection,
	num,
}: {
	collection: Collection;
	num: string;
}) {
	const cover = collection.coverImage;
	const href = collection.slug
		? `/curated/collections/${collection.slug}`
		: null;
	const allLabel = `All in ${collection.title ?? 'collection'} →`;

	return (
		<div>
			{cover?.image &&
				(href ? (
					<Link
						href={href}
						className="group block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						<div className="relative aspect-[4/3] overflow-hidden bg-foreground/[0.06] sm:aspect-[16/7] lg:aspect-[12/4]">
							<ImageBlock
								className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
								imageObj={cover}
								alt={collection.title ?? ''}
								sizes="100vw"
							/>
						</div>
					</Link>
				) : (
					<div className="relative aspect-[4/3] overflow-hidden bg-foreground/[0.06] sm:aspect-[16/7] lg:aspect-[12/4]">
						<ImageBlock
							className="h-full w-full object-cover"
							imageObj={cover}
							alt={collection.title ?? ''}
							sizes="100vw"
						/>
					</div>
				))}

			<div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-foreground/15 pt-4">
				<h2 className="flex items-baseline gap-3">
					<span className="t-l-2 text-foreground/40">{num}</span>
					<span className="text-[clamp(1.25rem,2.6vw,2rem)] uppercase leading-none tracking-[-0.02em] text-balance">
						{collection.title}
					</span>
				</h2>
				{href && (
					<Link
						href={href}
						className="t-l-2 inline-flex items-center whitespace-nowrap uppercase text-foreground/70 transition-colors hover:text-mark-ink pointer-coarse:min-h-11"
					>
						{allLabel}
					</Link>
				)}
			</div>

			{collection.description && (
				<p className="t-b-1 mt-3 max-w-[60ch] leading-relaxed text-foreground/70">
					{collection.description}
				</p>
			)}
		</div>
	);
}

export function PageCuratedIndex({ data }: Props) {
	const { title, subtitle, description, collections, categories } = data || {};
	const reveal = useReveal();

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<motion.section
				className="mb-14 lg:mb-24"
				{...reveal}
				transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
			>
				{subtitle && (
					<p className="t-l-2 mb-5 uppercase text-foreground/65 lg:mb-7">
						{subtitle}
					</p>
				)}
				{title && (
					<h1 className="text-balance t-h-1 uppercase max-w-sm">{title}</h1>
				)}
				{description && (
					<p className="t-b-1 mt-7 max-w-[60ch] leading-relaxed text-foreground/70 lg:mt-9">
						{description}
					</p>
				)}
			</motion.section>

			<div className="pb-4">
				<CuratedCategoriesGrid
					categories={categories ?? null}
					showViewAll
					priority
				/>
			</div>

			{collections?.map((collection, index) => {
				const products = collection.products;
				return (
					<motion.section
						key={collection._id}
						className="mt-14 border-t border-foreground/10 pt-12 lg:mt-24 lg:pt-20"
						{...reveal}
						transition={{
							duration: 0.8,
							delay: index * 0.06,
							ease: [0, 0.5, 0.5, 1],
						}}
					>
						<CollectionMasthead
							collection={collection}
							num={String(index + 1).padStart(2, '0')}
						/>

						{products && products.length > 0 && (
							<div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-y-16 2xl:gap-x-10  2xl:grid-cols-4">
								{products.map((product, productIndex) => (
									<CuratedProductCard
										key={product._id}
										product={product}
										index={productIndex}
									/>
								))}
							</div>
						)}
					</motion.section>
				);
			})}
		</div>
	);
}
