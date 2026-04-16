import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageCuratedSingleQuery,
	pageCuratedSlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import PageCuratedSingle from './_components/PageCuratedSingle';

type Props = {
	params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageCuratedSlugsQuery,
		perspective: 'published',
		stega: false,
	});
	return data ?? [];
}

const getCachedCuratedData = cache(async (slug: string) =>
	sanityFetch({
		query: pageCuratedSingleQuery,
		params: { slug },
		tags: ['pCurated', 'pCuratedCategory'],
	})
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const { data } = await getCachedCuratedData(slug);
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page({ params }: Props) {
	const { slug } = await params;
	const { data } = await getCachedCuratedData(slug);

	if (!data) return notFound();

	return <PageCuratedSingle data={data} />;
}
