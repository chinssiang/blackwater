import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedIndexQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { PageCuratedIndex } from './_components/PageCuratedIndex';

export async function generateMetadata(): Promise<Metadata> {
	const { data } = await sanityFetch({
		query: pageCuratedIndexQuery,
		tags: ['pCuratedIndex'],
		stega: false,
	});
	return defineMetadata({ data });
}

export default async function Page() {
	const { data } = await sanityFetch({
		query: pageCuratedIndexQuery,
		tags: [
			'pCuratedIndex',
			'pCurated',
			'pCuratedCategory',
			'pCuratedCollection',
		],
	});
	console.log('🚀 ~ :22 ~ Page ~ data:', data);

	if (!data) return notFound();

	return <PageCuratedIndex data={data} />;
}
