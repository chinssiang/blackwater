import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedCategoriesIndexQuery } from '@/sanity/lib/queries';
import { PageCuratedCategoriesIndex } from './_components/PageCuratedCategoriesIndex';

const getCachedData = cache(async () =>
	sanityFetch({
		query: pageCuratedCategoriesIndexQuery,
		tags: ['pCuratedCategory', 'pCurated'],
	})
);

export const metadata: Metadata = {
	title: 'Curated Categories',
};

export default async function Page() {
	const { data } = await getCachedData();

	if (!data) return notFound();

	return <PageCuratedCategoriesIndex data={data} />;
}
