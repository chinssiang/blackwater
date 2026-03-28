import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageCuratedCollectionSingleQuery,
	pageCuratedCollectionSlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import PageCuratedCollection from './_components/PageCuratedCollection';

type Props = {
	params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageCuratedCollectionSlugsQuery,
		perspective: 'published',
		stega: false,
	});
	return data ?? [];
}

const getCachedCollectionData = cache(async (slug: string) =>
	sanityFetch({
		query: pageCuratedCollectionSingleQuery,
		params: { slug },
		tags: ['pCuratedCollection', 'pCurated', 'pCuratedCategory'],
	})
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const { data } = await getCachedCollectionData(slug);
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page({ params }: Props) {
	const { slug } = await params;
	const { data } = await getCachedCollectionData(slug);

	if (!data) return notFound();

	return <PageCuratedCollection data={data} />;
}
