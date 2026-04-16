import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedProductsIndexQuery } from '@/sanity/lib/queries';
import { PageCuratedProductsIndex } from './_components/PageCuratedProductsIndex';

const getCachedData = cache(async () =>
	sanityFetch({
		query: pageCuratedProductsIndexQuery,
		tags: ['pCurated', 'pCuratedCategory'],
	})
);

export const metadata: Metadata = {
	title: 'Curated Products',
};

export default async function Page() {
	const { data } = await getCachedData();

	if (!data) return notFound();

	return <PageCuratedProductsIndex data={data} />;
}
