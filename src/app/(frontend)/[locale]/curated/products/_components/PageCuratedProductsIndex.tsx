'use client';

import CuratedProductCard from '../../_components/CuratedProductCard';
import CuratedCategoriesGrid from '../../_components/CuratedCategoriesGrid';
import CuratedPageHeader from '../../_components/CuratedPageHeader';
import type { PageCuratedProductsIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedProductsIndexQueryResult>;
};

export function PageCuratedProductsIndex({ data }: Props) {
	const { products, categories } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<CuratedPageHeader
				title="Products"
				counts={[{ count: products?.length, unit: 'product' }]}
			/>

			{products && products.length > 0 ? (
				<div className="mb-20 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
					{products.map((product, index) => (
						<CuratedProductCard
							key={product._id}
							product={product}
							index={index}
						/>
					))}
				</div>
			) : (
				<p className="t-b-1 max-w-[40ch] text-foreground/60">
					Nothing here yet. Picks are added as the club vets new gear.
				</p>
			)}

			{categories && categories.length > 0 && (
				<div className="border-t border-foreground/10 pt-12 lg:pt-16">
					<CuratedCategoriesGrid categories={categories} />
				</div>
			)}
		</div>
	);
}
