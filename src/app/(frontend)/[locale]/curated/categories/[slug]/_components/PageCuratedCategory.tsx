'use client';

import CuratedProductCard from '../../../_components/CuratedProductCard';
import CuratedPageHeader from '../../../_components/CuratedPageHeader';
import type { PageCuratedCategorySingleQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCategorySingleQueryResult>;
};

export default function PageCuratedCategory({ data }: Props) {
	const { title, products } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<CuratedPageHeader
				kicker="Category"
				title={title}
				count={products?.length}
				unit="product"
			/>

			{products && products.length > 0 ? (
				<div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16">
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
					No picks in this category yet. Check back as the shelf grows.
				</p>
			)}
		</div>
	);
}
