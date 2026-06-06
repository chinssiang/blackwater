'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';
import CuratedPageHeader from '../../_components/CuratedPageHeader';
import type { PageCuratedCollectionsIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCollectionsIndexQueryResult>;
};

export function PageCuratedCollectionsIndex({ data }: Props) {
	const { collections } = data || {};
	const reveal = useReveal();

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<CuratedPageHeader
				title="Collections"
				count={collections?.length}
				unit="collection"
			/>

			{collections && collections.length > 0 ? (
				<div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
					{collections.map((collection, index) => {
						return (
							<motion.article
								key={collection._id}
								{...reveal}
								transition={{
									duration: 0.8,
									delay: index * 0.06,
									ease: [0, 0.5, 0.5, 1],
								}}
							>
								<Link
									href={`/curated/collections/${collection.slug}`}
									className="group flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background"
								>
									<div className="relative mb-3 aspect-4/3 overflow-hidden bg-foreground/[0.06]">
										{collection.coverImage ? (
											<ImageBlock
												className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
												imageObj={collection.coverImage}
												alt={collection.title ?? ''}
											/>
										) : (
											<div className="h-full w-full bg-foreground/[0.06]" />
										)}
									</div>
									<div className="flex items-baseline justify-between gap-3 border-t border-foreground/15 pt-3">
										<span className="t-h-3 uppercase transition-opacity duration-200 group-hover:opacity-60">
											{collection.title}
										</span>
										{collection.count != null && (
											<span className="t-l-2 whitespace-nowrap uppercase text-foreground/65">
												{collection.count}{' '}
												{collection.count === 1 ? 'product' : 'products'}
											</span>
										)}
									</div>
									{collection.description && (
										<p className="t-b-2 mt-2 line-clamp-2 max-w-[42ch] text-foreground/60">
											{collection.description}
										</p>
									)}
								</Link>
							</motion.article>
						);
					})}
				</div>
			) : (
				<p className="t-b-1 max-w-[40ch] text-foreground/60">
					No collections yet. They group picks around a theme or season.
				</p>
			)}
		</div>
	);
}
