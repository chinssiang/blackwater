'use client';

import Link from 'next/link';
import type { WithoutPageMetadata } from '@/lib/defineMetadata';
import { resolveHref } from '@/lib/routes';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import ProductCard from '@/components/ProductCard';
import ProductCategoriesGrid from '../../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../../_components/ProductPageHeader';
import type { PageProductCollectionSingleQueryResult } from 'sanity.types';

type Props = {
	data: WithoutPageMetadata<
		NonNullable<PageProductCollectionSingleQueryResult>
	>;
};

export default function PageProductCollection({ data }: Props) {
	const locale = useLocale();
	const breadcrumb = useTranslations('breadcrumb');
	const t = useTranslations('products');
	const { title, description, products, categories } = data || {};

	return (
		<>
			{/* Breadcrumb */}
			<nav
				aria-label="Breadcrumb"
				className="m-x-max reveal t-l-2 text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 uppercase lg:mb-16"
			>
				<Link
					href={resolveHref({ documentType: 'pProductIndex', locale })!}
					className="hover:text-foreground inline-flex items-center transition-colors pointer-coarse:min-h-11"
				>
					{breadcrumb.products}
				</Link>
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<Link
					href={resolveHref({
						documentType: 'pProductCollectionsIndex',
						locale,
					})!}
					className="hover:text-foreground inline-flex items-center transition-colors pointer-coarse:min-h-11"
				>
					{t.collectionsTitle}
				</Link>
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<span aria-current="page" className="text-foreground/90">
					{title}
				</span>
			</nav>

			<ProductPageHeader
				title={title}
				counts={[{ count: products?.length, forms: t.productCount }]}
				lede={description}
			/>

			{/* Product grid */}
			{products && products.length > 0 && (
				<div className="m-x-max mb-20 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-3 lg:gap-y-16 xl:grid-cols-4 2xl:gap-x-10">
					{products.map((product, index) => (
						<ProductCard
							key={product._id}
							product={product}
							index={index}
							// This grid goes four-up at `xl`, one breakpoint earlier than the
							// default assumes, so between 1280 and 1536 the default asks for a
							// third of the viewport to fill a quarter-width card.
							sizes="(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (min-width: 2000px) 470px, 25vw"
						/>
					))}
				</div>
			)}

			{/* Categories section */}
			{categories && categories.length > 0 && (
				<div className="m-x-max border-foreground/10 border-t pt-12 lg:pt-16">
					<ProductCategoriesGrid categories={categories} showViewAll />
				</div>
			)}
		</>
	);
}
