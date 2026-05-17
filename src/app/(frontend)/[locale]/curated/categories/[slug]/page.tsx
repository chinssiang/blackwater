import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageCuratedCategorySingleQuery,
	pageCuratedCategorySlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import PageCuratedCategory from './_components/PageCuratedCategory';

type Props = {
	params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageCuratedCategorySlugsQuery,
		perspective: 'published',
		stega: false,
	});
	return data ?? [];
}

const getCachedCategoryData = cache(async (slug: string) =>
	sanityFetch({
		query: pageCuratedCategorySingleQuery,
		params: { slug },
		tags: ['pCuratedCategory', 'pCurated'],
	})
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const { data } = await getCachedCategoryData(slug);
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page({ params }: Props) {
	const { slug } = await params;
	const { data } = await getCachedCategoryData(slug);

	if (!data) return notFound();

	return <PageCuratedCategory data={data} />;
}
