'use client';

import { ArrowRight } from '@/components/SvgIcons';
import { hasArrayValue } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { localizePath } from '@/lib/i18n';
import { interpolate } from '@/lib/dictionary';
import ImageBlock from '@/components/ImageBlock';
import ProductCategoriesGrid from './ProductCategoriesGrid';
import ProductGrid from './ProductGrid';
import ProductBrowser, { type ProductSelection } from './ProductBrowser';
import type { PageProductIndexQueryResult } from 'sanity.types';
import { Button } from '@/components/ui/Button';

type Props = {
	data: NonNullable<PageProductIndexQueryResult>;
	selected: ProductSelection;
	sort: string;
};

type Collection = NonNullable<
	NonNullable<NonNullable<PageProductIndexQueryResult>['collections']>[number]
>;

function MoreProductsButton({ href, label }: { href: string; label: string }) {
	return (
		<div className="mt-20 flex justify-center lg:mt-30">
			<Button
				asChild
				size="lg"
				className="t-l-1 whitespace-nowrap uppercase transition-colors pointer-coarse:min-h-11 px-6"
			>
				<Link href={href}>{label}</Link>
			</Button>
		</div>
	);
}

function CollectionMasthead({ collection }: { collection: Collection }) {
	const locale = useLocale();
	const t = useTranslations('products');
	const cover = collection.coverImage;
	const href = collection.slug
		? resolveHref({
				documentType: 'pProductCollection',
				slug: collection.slug,
				locale,
			})
		: null;
	const allLabel = interpolate(t.allCollection, {
		collection: collection.title ?? '',
	}).trim();

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
						className="t-l-2 inline-flex items-center whitespace-nowrap uppercase text-foreground/70 transition-colors hover:text-accent-foreground pointer-coarse:min-h-11 gap-1"
					>
						{allLabel}
						<ArrowRight className="size-2.5" />
					</Link>
				)}
			</div>
		</div>
	);
}

export function PageProductIndex({ data, selected, sort }: Props) {
	const {
		title,
		subtitle,
		description,
		collections,
		categories,
		allProducts,
		allProductsList,
		allProductsTotal,
		facetCategories,
		facetBrands,
		badgeCounts,
	} = data || {};
	const reveal = useReveal();
	const locale = useLocale();
	const t = useTranslations('products');
	const searchParams = useSearchParams();
	const allProductsHref = localizePath('/products/all', locale);

	// Carry the active filters/sort over to the all-products page.
	const qs = searchParams.toString();
	const filteredAllHref = allProductsHref + (qs ? `?${qs}` : '');

	// Curated showcase shown when no filter is active.
	const showcase = (
		<>
			<ProductCategoriesGrid
				categories={categories ?? null}
				showViewAll
				priority
			/>

			{collections?.map((collection, index) => {
				if (!collection) return null;
				const products = collection.products;
				if (!hasArrayValue(products)) return null;
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
							<ProductGrid products={products} className="mt-8 lg:mt-12" />
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
						<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
							{allProducts?.title && (
								<h2 className="text-[clamp(1.25rem,2.6vw,2rem)] uppercase leading-none text-balance">
									{allProducts.title}
								</h2>
							)}
							<Link
								href={allProductsHref}
								className="t-l-2 ml-auto inline-flex items-center whitespace-nowrap uppercase text-foreground/70 transition-colors hover:text-accent-foreground pointer-coarse:min-h-11 gap-1"
							>
								{t.allProducts}
								<ArrowRight className="size-2.5" />
							</Link>
						</div>
						{allProducts?.description && (
							<p className="t-b-1 mt-3 max-w-[60ch] leading-relaxed text-foreground/70">
								{allProducts.description}
							</p>
						)}
					</div>

					<ProductGrid
						products={allProductsList}
						className="mt-8 lg:mt-12"
					/>

					<MoreProductsButton
						href={allProductsHref}
						label={t.moreProducts}
					/>
				</motion.section>
			)}
		</>
	);

	// When filtering collapses the showcase, offer a jump to the full paginated
	// list (which carries the same filters) if there are more matches than shown.
	const hasMore = (allProductsTotal ?? 0) > (allProductsList?.length ?? 0);
	const filteredFooter = hasMore ? (
		<MoreProductsButton href={filteredAllHref} label={t.moreProducts} />
	) : null;

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

			<ProductBrowser
				facetCategories={facetCategories ?? []}
				facetBrands={facetBrands ?? []}
				badgeCounts={badgeCounts}
				selected={selected}
				sort={sort}
				products={allProductsList ?? []}
				footer={filteredFooter}
				showcase={showcase}
			/>
		</>
	);
}
