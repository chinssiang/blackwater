'use client';

import CuratedProductCard from '../../../_components/CuratedProductCard';
import CuratedCategoriesGrid from '../../../_components/CuratedCategoriesGrid';
import CuratedPageHeader from '../../../_components/CuratedPageHeader';
import type { PageCuratedCollectionSingleQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCollectionSingleQueryResult>;
};

export default function PageCuratedCollection({ data }: Props) {
	const { title, description, products, categories } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<CuratedPageHeader
				kicker="Collection"
				title={title}
				count={products?.length}
				unit="product"
				lede={description}
			/>

			{/* Product grid */}
			{products && products.length > 0 && (
				<div className="mb-20 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 xl:grid-cols-4">
					{products.map((product, index) => (
						<CuratedProductCard
							key={product._id}
							product={product}
							index={index}
						/>
					))}
				</div>
			)}

			{/* Categories section */}
			{categories && categories.length > 0 && (
				<div className="border-t border-foreground/10 pt-12 lg:pt-16">
					<CuratedCategoriesGrid categories={categories} showViewAll />
				</div>
			)}
		</div>
	);
}
