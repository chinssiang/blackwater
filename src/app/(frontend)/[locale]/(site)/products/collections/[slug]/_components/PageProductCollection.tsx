'use client';

import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import ProductCategoriesGrid from '../../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../../_components/ProductPageHeader';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import type { PageProductCollectionSingleQueryResult } from 'sanity.types';
import type { WithoutPageMetadata } from '@/lib/defineMetadata';

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
				className="m-x-max reveal t-l-2 uppercase text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 lg:mb-16"
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
				<Link
					href={
						resolveHref({
							documentType: 'pProductCollectionsIndex',
							locale,
						})!
					}
					className="inline-flex items-center transition-colors hover:text-foreground pointer-coarse:min-h-11"
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
				kicker={t.kickerCollection}
				title={title}
				counts={[{ count: products?.length, forms: t.productCount }]}
				lede={description}
			/>

			{/* Product grid */}
			{products && products.length > 0 && (
				<div className="m-x-max mb-20 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-3 lg:gap-y-16 xl:grid-cols-4 2xl:gap-x-10">
					{products.map((product, index) => (
						<ProductCard key={product._id} product={product} index={index} />
					))}
				</div>
			)}

			{/* Categories section */}
			{categories && categories.length > 0 && (
				<div className="m-x-max border-t border-foreground/10 pt-12 lg:pt-16">
					<ProductCategoriesGrid categories={categories} showViewAll />
				</div>
			)}
		</>
	);
}
