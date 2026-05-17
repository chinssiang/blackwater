import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedIndexQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { PageCuratedIndex } from './_components/PageCuratedIndex';

const getCachedCuratedIndexData = cache(async () =>
	sanityFetch({
		query: pageCuratedIndexQuery,
		tags: ['pCuratedIndex', 'pCurated', 'pCuratedCategory', 'pCuratedCollection'],
	})
);

export async function generateMetadata(): Promise<Metadata> {
	const { data } = await getCachedCuratedIndexData();
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page() {
	const { data } = await getCachedCuratedIndexData();

	if (!data) return notFound();

	return <PageCuratedIndex data={data} />;
}
