import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductIndexQuery } from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import { type Locale } from '@/lib/i18n';
import {
	parseProductFilters,
	type ProductFilters,
	type ProductFilterSearchParams,
} from '@/lib/productFilters';
import { PageProductIndex } from './_components/PageProductIndex';

const getCachedProductIndexData = cache(
	async (locale: string, filters: ProductFilters) =>
		sanityFetch({
			query: pageProductIndexQuery,
			params: {
				locale,
				categories: filters.categories,
				brands: filters.brands,
				badges: filters.badges,
				sort: filters.sort,
			},
			tags: [
				'pProductIndex',
				'pProduct',
				'pProductCategory',
				'pProductCollection',
				'pBrand',
			],
		})
);

// Canonical (unfiltered) view used for metadata regardless of active filters.
const UNFILTERED: ProductFilters = {
	categories: [],
	brands: [],
	badges: [],
	sort: 'az',
};

type Props = {
	params: Promise<{ locale: string }>;
	searchParams: Promise<ProductFilterSearchParams>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedProductIndexData(locale, UNFILTERED);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function Page(props: Props) {
	const { locale } = await props.params;
	const filters = parseProductFilters(await props.searchParams);
	const { data } = await getCachedProductIndexData(locale, filters);

	if (!data) return <NotFoundContent locale={locale} />;

	return (
		<PageProductIndex
			data={data}
			selected={{
				categories: filters.categories,
				brands: filters.brands,
				badges: filters.badges,
			}}
			sort={filters.sort}
		/>
	);
}
