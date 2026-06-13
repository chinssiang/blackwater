'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { pickPlural, interpolate } from '@/lib/dictionary';
import ProductPageHeader from '../../_components/ProductPageHeader';
import type { PageProductCollectionsIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageProductCollectionsIndexQueryResult>;
};

export function PageProductCollectionsIndex({ data }: Props) {
	const { collections } = data || {};
	const reveal = useReveal();
	const locale = useLocale();
	const breadcrumb = useTranslations('breadcrumb');
	const t = useTranslations('products');

	return (
		<>
			{/* Breadcrumb */}
			<motion.nav
				aria-label="Breadcrumb"
				className="t-l-2 uppercase text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 lg:mb-16"
				{...reveal}
				transition={{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }}
			>
				<Link
					href={resolveHref({ documentType: 'pProductIndex', locale })!}
					className="inline-flex items-center transition-colors hover:text-foreground pointer-coarse:min-h-11"
				>
					{breadcrumb.products}
				</Link>
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<span aria-current="page" className="text-foreground/90">
					{t.collectionsTitle}
				</span>
			</motion.nav>

			<ProductPageHeader
				title={t.collectionsTitle}
				counts={[{ count: collections?.length, forms: t.collectionCount }]}
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
									href={
										resolveHref({
											documentType: 'pProductCollection',
											slug: collection.slug,
											locale,
										})!
									}
									className="group flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
								>
									<div className="relative mb-3 aspect-4/3 overflow-hidden bg-foreground/6 hidden">
										{collection.coverImage ? (
											<ImageBlock
												className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
												imageObj={collection.coverImage}
												alt={collection.title ?? ''}
											/>
										) : (
											<div className="h-full w-full bg-foreground/6" />
										)}
									</div>
									<div className="flex items-baseline justify-between gap-3 border-t border-foreground/15 pt-3">
										<span className="t-h-3 uppercase transition-opacity duration-200 group-hover:opacity-60">
											{collection.title}
										</span>
										{collection.count != null && (
											<span className="t-l-2 whitespace-nowrap uppercase text-foreground/65">
												{interpolate(
													pickPlural(t.productCount, collection.count),
													{ count: collection.count }
												)}
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
		</>
	);
}
