'use client';

import ProductCategoriesGrid from '../../_components/ProductCategoriesGrid';
import ProductPageHeader from '../../_components/ProductPageHeader';
import type { PageProductCategoriesIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageProductCategoriesIndexQueryResult>;
};

export function PageProductCategoriesIndex({ data }: Props) {
	const { categories, productCount } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<ProductPageHeader
				title="Categories"
				counts={[
					{ count: productCount, unit: 'product' },
					{ count: categories?.length, unit: 'category' },
				]}
			/>

			<ProductCategoriesGrid
				categories={categories ?? null}
				heading={null}
				priority
			/>
		</div>
	);
}
