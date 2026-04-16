import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedCollectionsIndexQuery } from '@/sanity/lib/queries';
import { PageCuratedCollectionsIndex } from './_components/PageCuratedCollectionsIndex';

const getCachedData = cache(async () =>
	sanityFetch({
		query: pageCuratedCollectionsIndexQuery,
		tags: ['pCuratedCollection'],
	})
);

export const metadata: Metadata = {
	title: 'Curated Collections',
};

export default async function Page() {
	const { data } = await getCachedData();

	if (!data) return notFound();

	return <PageCuratedCollectionsIndex data={data} />;
}
