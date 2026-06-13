'use client';

import { cn, hasArrayValue } from '@/lib/utils';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { localizePath } from '@/lib/i18n';
import ImageBlock from '@/components/ImageBlock';
import ProductCard from './ProductCard';
import ProductCategoriesGrid from './ProductCategoriesGrid';
import type { PageProductIndexQueryResult } from 'sanity.types';
import { Button } from '@/components/ui/Button';

type Props = {
	data: NonNullable<PageProductIndexQueryResult>;
};

type Collection = NonNullable<
	NonNullable<PageProductIndexQueryResult>['collections']
>[number];

function CollectionMasthead({ collection }: { collection: Collection }) {
	const locale = useLocale();
	const cover = collection.coverImage;
	const href = collection.slug
		? resolveHref({
				documentType: 'pProductCollection',
				slug: collection.slug,
				locale,
			})
		: null;
	const allLabel = `All ${collection.title ?? 'collection'}`;

	return (
		<div className="border-t border-foreground/15 pt-4">
			{cover?.image &&
				(href ? (
					<Link
						href={href}
						className="group block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						<div className="relative aspect-4/3] overflow-hidden bg-foreground/6 sm:aspect-16/7 lg:aspect-12/4">
							<ImageBlock
								className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
								imageObj={cover}
								alt={collection.title ?? ''}
								sizes="100vw"
							/>
						</div>
					</Link>
				) : (
					<div className="relative aspect-4/3 overflow-hidden bg-foreground/6 sm:aspect-16/7 lg:aspect-12/4">
						<ImageBlock
							className="h-full w-full object-cover"
							imageObj={cover}
							alt={collection.title ?? ''}
							sizes="100vw"
						/>
					</div>
				))}

			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
				<div>
					<h2 className="text-[clamp(1.25rem,2.6vw,2rem)] uppercase leading-none text-balance tracking-tight">
						{collection.title}
					</h2>
					{collection.description && (
						<p className="t-b-1 mt-3 max-w-[60ch] leading-relaxed text-foreground/70">
							{collection.description}
						</p>
					)}
				</div>
				{href && (
					<Link
						href={href}
						className="t-l-2 inline-flex items-center whitespace-nowrap uppercase text-foreground/70 transition-colors hover:text-accent-foreground pointer-coarse:min-h-11"
					>
						{allLabel}
					</Link>
				)}
			</div>
		</div>
	);
}

export function PageProductIndex({ data }: Props) {
	const {
		title,
		subtitle,
		description,
		collections,
		categories,
		allProducts,
		allProductsList,
	} = data || {};
	const reveal = useReveal();
	const locale = useLocale();
	const t = useTranslations('products');
	const allProductsHref = localizePath('/products/all', locale);

	return (
		<>
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

			<ProductCategoriesGrid
				categories={categories ?? null}
				showViewAll
				priority
			/>

			{collections?.map((collection, index) => {
				const products = collection.products;
				if (!hasArrayValue(products)) {
					return null;
				}
				return (
					<motion.section
						key={collection._id}
						className="mt-14 lg:mt-24"
						{...reveal}
						transition={{
							duration: 0.8,
							delay: index * 0.06,
							ease: [0, 0.5, 0.5, 1],
						}}
					>
						<CollectionMasthead collection={collection} />

						{products && products.length > 0 && (
							<div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-y-16 2xl:gap-x-10 2xl:grid-cols-4">
								{products.map((product, productIndex) => (
									<ProductCard
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

			{hasArrayValue(allProductsList) && (
				<motion.section
					className="mt-14 lg:mt-24"
					{...reveal}
					transition={{ duration: 0.8, ease: [0, 0.5, 0.5, 1] }}
				>
					<div className="border-t border-foreground/15 pt-4">
						<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
							{allProducts?.title && (
								<h2 className="text-[clamp(1.25rem,2.6vw,2rem)] uppercase leading-none text-balance">
									{allProducts.title}
								</h2>
							)}
							<Link
								href={allProductsHref}
								className="t-l-2 ml-auto inline-flex items-center whitespace-nowrap uppercase text-foreground/70 transition-colors hover:text-accent-foreground pointer-coarse:min-h-11"
							>
								{t.allProducts}
							</Link>
						</div>
						{allProducts?.description && (
							<p className="t-b-1 mt-3 max-w-[60ch] leading-relaxed text-foreground/70">
								{allProducts.description}
							</p>
						)}
					</div>

					<div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-y-16 2xl:gap-x-10 2xl:grid-cols-4">
						{allProductsList.map((product, productIndex) => (
							<ProductCard
								key={product._id}
								product={product}
								index={productIndex}
							/>
						))}
					</div>

					<div className="mt-20 flex justify-center lg:mt-30">
						<Button
							asChild
							size="lg"
							className="t-l-1 whitespace-nowrap uppercase transition-colors pointer-coarse:min-h-11 px-6"
						>
							<Link href={allProductsHref}>{t.moreProducts}</Link>
						</Button>
					</div>
				</motion.section>
			)}
		</>
	);
}
