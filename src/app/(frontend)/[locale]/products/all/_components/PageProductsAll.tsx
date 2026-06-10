'use client';

import ProductCard from '../../_components/ProductCard';
import ProductCategoriesGrid from '../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../_components/ProductPageHeader';
import { useTranslations } from '@/components/LocaleProvider';
import type { PageProductsAllQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageProductsAllQueryResult>;
};

export function PageProductsAll({ data }: Props) {
	const t = useTranslations('products');
	const { products, categories } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<ProductPageHeader
				title={t.allProducts}
				counts={[{ count: products?.length, forms: t.productCount }]}
			/>

			{products && products.length > 0 ? (
				<div className="mb-20 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
					{products.map((product, index) => (
						<ProductCard key={product._id} product={product} index={index} />
					))}
				</div>
			) : (
				<p className="t-b-1 max-w-[40ch] text-foreground/60">
					Nothing here yet. Picks are added as the club vets new gear.
				</p>
			)}

			{categories && categories.length > 0 && (
				<div className="border-t border-foreground/10 pt-12 lg:pt-16">
					<ProductCategoriesGrid categories={categories} />
				</div>
			)}
		</div>
	);
}
