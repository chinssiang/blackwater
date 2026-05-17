'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';
import type { PageCuratedCollectionsIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCollectionsIndexQueryResult>;
};

export function PageCuratedCollectionsIndex({ data }: Props) {
	const { collections } = data || {};

	return (
		<div className="theme-light bg-background text-foreground px-contain mx-auto min-h-[inherit] py-10 lg:py-17.5">
			<motion.div
				className="mb-10 lg:mb-17.5"
				initial="hide"
				animate="show"
				variants={fadeAnim}
				transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
			>
				<h1 className="t-h-2 uppercase">Collections</h1>
			</motion.div>

			{collections && collections.length > 0 ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{collections.map((collection, index) => (
						<motion.article
							key={collection._id}
							initial="hide"
							animate="show"
							variants={fadeAnim}
							transition={{
								duration: 0.8,
								delay: index * 0.06,
								ease: [0, 0.5, 0.5, 1],
							}}
						>
							<Link
								href={`/curated/collections/${collection.slug}`}
								className="group flex flex-col h-full"
							>
								<div className="relative aspect-4/3 overflow-hidden bg-foreground/5 mb-3">
									{collection.coverImage ? (
										<ImageBlock
											className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
											imageObj={collection.coverImage}
											alt={collection.title ?? ''}
										/>
									) : (
										<div className="w-full h-full bg-foreground/5" />
									)}
								</div>
								<div className="flex items-baseline justify-between">
									<h2 className="t-h-5 uppercase">{collection.title}</h2>
									{collection.count != null && (
										<span className="t-h-6 text-muted">
											{collection.count}
										</span>
									)}
								</div>
								{collection.description && (
									<p className="t-b-2 text-muted mt-1 line-clamp-2">
										{collection.description}
									</p>
								)}
							</Link>
						</motion.article>
					))}
				</div>
			) : (
				<p className="t-b-2 text-muted">No collections yet.</p>
			)}
		</div>
	);
}
