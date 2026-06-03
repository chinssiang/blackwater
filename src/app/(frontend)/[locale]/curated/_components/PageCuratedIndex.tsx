'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';
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

const scrim =
	'pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,oklch(0.1_0_0/0.85),oklch(0.1_0_0/0.15)_55%,transparent)]';

function CollectionMasthead({ collection }: { collection: Collection }) {
	const allLabel = `All in ${collection.title ?? 'collection'} →`;
	const cover = collection.coverImage;

	if (cover?.image) {
		return (
			<div className="relative overflow-hidden aspect-[4/3] sm:aspect-[16/7] lg:aspect-[12/4]">
				<ImageBlock
					className="w-full h-full object-cover"
					imageObj={cover}
					alt={collection.title ?? ''}
					sizes="100vw"
				/>
				<div className={scrim} />
				<div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 lg:p-8">
					<div className="max-w-[55ch]">
						<h2 className="t-h-2 uppercase text-foreground">
							{collection.title}
						</h2>
						{collection.description && (
							<p className="t-b-1 mt-2 text-[oklch(0.98_0_0/0.78)]">
								{collection.description}
							</p>
						)}
					</div>
					{collection.slug && (
						<Link
							href={`/curated/collections/${collection.slug}`}
							className="t-l-2 uppercase whitespace-nowrap text-[oklch(0.98_0_0/0.85)] transition-colors hover:text-foreground"
						>
							{allLabel}
						</Link>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-wrap items-end justify-between gap-4">
			<div className="max-w-[55ch]">
				<h2 className="t-h-2 uppercase text-foreground">{collection.title}</h2>
				{collection.description && (
					<p className="t-b-1 mt-2 text-foreground/80">
						{collection.description}
					</p>
				)}
			</div>
			{collection.slug && (
				<Link
					href={`/curated/collections/${collection.slug}`}
					className="t-l-2 uppercase whitespace-nowrap text-foreground/75 transition-colors hover:text-foreground"
				>
					{allLabel}
				</Link>
			)}
		</div>
	);
}

export function PageCuratedIndex({ data }: Props) {
	const { title, subtitle, description, collections, categories } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<motion.section
				className="mb-12 lg:mb-20"
				initial="hide"
				animate="show"
				variants={fadeAnim}
				transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
			>
				{subtitle && (
					<p className="t-l-2 uppercase text-foreground/70 mb-4 lg:mb-6">
						{subtitle}
					</p>
				)}
				{title && (
					<h1 className="uppercase text-foreground tracking-[-0.02em] leading-[1.1] text-balance text-[clamp(1.375rem,2.4vw,2rem)] max-w-[34ch]">
						{title}
					</h1>
				)}
				{description && (
					<p className="t-b-1 text-foreground/80 mt-6 lg:mt-8 max-w-[60ch]">
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
						className="border-t border-foreground/10 mt-12 pt-12 lg:mt-20 lg:pt-20"
						initial="hide"
						animate="show"
						variants={fadeAnim}
						transition={{
							duration: 0.8,
							delay: index * 0.06,
							ease: [0, 0.5, 0.5, 1],
						}}
					>
						<CollectionMasthead collection={collection} />

						{products && products.length > 0 && (
							<div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
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
