'use client';

import Link from 'next/link';
import { REVEAL_SOFT, revealStagger } from '@/lib/animate';
import type { WithoutPageMetadata } from '@/lib/defineMetadata';
import { interpolate } from '@/lib/dictionary';
import { localizePath } from '@/lib/i18n';
import { resolveHref } from '@/lib/routes';
import { cn, hasArrayValue } from '@/lib/utils';
import ImageBlock from '@/components/ImageBlock';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import ProductCard from '@/components/ProductCard';
import { ArrowRight } from '@/components/SvgIcons';
import { buttonVariants } from '@/components/ui/Button';
import ProductCategoriesGrid from './ProductCategoriesGrid';
import type { PageProductIndexQueryResult } from 'sanity.types';

type Props = {
	data: WithoutPageMetadata<NonNullable<PageProductIndexQueryResult>>;
};

type Collection = NonNullable<
	NonNullable<NonNullable<PageProductIndexQueryResult>['collections']>[number]
>;

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
		<div className="border-foreground/15 border-t pt-4">
			{cover?.image &&
				(href ? (
					<Link
						href={href}
						className="group focus-visible:ring-accent-foreground focus-visible:ring-offset-background block overflow-hidden focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
					>
						<div className="bg-foreground/6 relative aspect-4/3 overflow-hidden sm:aspect-16/7 lg:aspect-12/4">
							<ImageBlock
								className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
								imageObj={cover}
								alt={collection.title ?? ''}
								sizes="100vw"
							/>
						</div>
					</Link>
				) : (
					<div className="bg-foreground/6 relative aspect-4/3 overflow-hidden sm:aspect-16/7 lg:aspect-12/4">
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
					<h2 className="t-h-2 text-balance uppercase">{collection.title}</h2>
					{collection.description && (
						<p className="t-b-1 text-foreground/70 mt-3 max-w-[60ch]">
							{collection.description}
						</p>
					)}
				</div>
				{href && (
					<Link
						href={href}
						className="t-l-2 text-foreground/70 hover:text-accent-foreground inline-flex items-center gap-1 whitespace-nowrap uppercase transition-colors pointer-coarse:min-h-11"
					>
						{allLabel}
						<ArrowRight className="size-2.5" />
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
	const locale = useLocale();
	const t = useTranslations('products');
	const allProductsHref = localizePath('/products/all', locale);

	// Exactly one image on the page gets fetchpriority="high" — the first one in
	// the viewport. Which block that is depends on the data, so derive it rather
	// than hard-code it: a category tile only renders an image when the category
	// has a cover (CategoryTile's `hasImage`), and a collection strip only renders
	// when it has products. Order of appearance: category covers → first non-empty
	// collection strip → the all-products grid.
	// categories[0], not .some(): ProductCategoriesGrid grants priority to index 0
	// only, and CategoryTile renders no image at all when its category has no
	// cover. Testing "any category has a cover" would hand priority to a tile
	// that renders nothing while suppressing it everywhere else — leaving the
	// page with zero fetchpriority="high" images.
	const categoriesHaveCover = Boolean(categories?.[0]?.coverImage?.image);
	const firstCollectionIndex =
		collections?.findIndex((c) => c && hasArrayValue(c.products)) ?? -1;
	const lcpOwner: 'categories' | 'collection' | 'all' = categoriesHaveCover
		? 'categories'
		: firstCollectionIndex >= 0
			? 'collection'
			: 'all';

	return (
		<>
			<section className="p-x-max mb-14 lg:mb-24">
				{subtitle && (
					<p className="t-l-2 text-foreground/65 mb-5 uppercase lg:mb-7">
						{subtitle}
					</p>
				)}
				{title && (
					<h1 className="t-h-1 max-w-sm text-balance uppercase">{title}</h1>
				)}
				{description && (
					<p className="t-b-1 text-foreground/70 mt-7 max-w-[60ch] lg:mt-9">
						{description}
					</p>
				)}
			</section>

			<ProductCategoriesGrid
				className="p-x-max"
				categories={categories ?? null}
				showViewAll
				priority={lcpOwner === 'categories'}
			/>

			{collections?.map((collection, index) => {
				if (!collection) {
					return null;
				}
				const products = collection.products;
				if (!hasArrayValue(products)) {
					return null;
				}
				return (
					<section
						key={collection._id}
						className="m-x-max reveal mt-14 lg:mt-24"
						style={revealStagger(index)}
					>
						<CollectionMasthead collection={collection} />

						{products && products.length > 0 && (
							<div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-12 lg:mt-12 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
								{products.map((product, productIndex) => (
									<ProductCard
										key={product._id}
										product={product}
										index={productIndex}
										priority={
											lcpOwner === 'collection' &&
											index === firstCollectionIndex &&
											productIndex === 0
										}
									/>
								))}
							</div>
						)}
					</section>
				);
			})}

			{hasArrayValue(allProductsList) && (
				<section className="m-x-max reveal mt-14 lg:mt-24" style={REVEAL_SOFT}>
					<div className="border-foreground/15 border-t pt-4">
						<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
							{allProducts?.title && (
								<h2 className="t-h-2 text-balance uppercase">
									{allProducts.title}
								</h2>
							)}
							<Link
								href={allProductsHref}
								className="t-l-2 text-foreground/70 hover:text-accent-foreground ml-auto inline-flex items-center gap-1 whitespace-nowrap uppercase transition-colors pointer-coarse:min-h-11"
							>
								{t.allProducts}
								<ArrowRight className="size-2.5" />
							</Link>
						</div>
						{allProducts?.description && (
							<p className="t-b-1 text-foreground/70 mt-3 max-w-[60ch]">
								{allProducts.description}
							</p>
						)}
					</div>

					<div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-12 lg:mt-12 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
						{allProductsList.map((product, productIndex) => (
							<ProductCard
								key={product._id}
								product={product}
								index={productIndex}
								priority={lcpOwner === 'all' && productIndex === 0}
							/>
						))}
					</div>

					<div className="mt-20 flex justify-center lg:mt-30">
						<Link
							href={allProductsHref}
							className={cn(
								buttonVariants({ size: 'lg' }),
								't-l-1 px-6 whitespace-nowrap uppercase pointer-coarse:min-h-11'
							)}
						>
							{t.moreProducts}
						</Link>
					</div>
				</section>
			)}
		</>
	);
}
