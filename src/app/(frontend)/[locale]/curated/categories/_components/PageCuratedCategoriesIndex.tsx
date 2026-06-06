'use client';

import CuratedCategoriesGrid from '../../_components/CuratedCategoriesGrid';
import CuratedPageHeader from '../../_components/CuratedPageHeader';
import type { PageCuratedCategoriesIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCategoriesIndexQueryResult>;
};

export function PageCuratedCategoriesIndex({ data }: Props) {
	const { categories, productCount } = data || {};

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			<CuratedPageHeader
				title="Categories"
				counts={[
					{ count: productCount, unit: 'product' },
					{ count: categories?.length, unit: 'category' },
				]}
			/>

			<CuratedCategoriesGrid
				categories={categories ?? null}
				heading={null}
				priority
			/>
		</div>
	);
}
