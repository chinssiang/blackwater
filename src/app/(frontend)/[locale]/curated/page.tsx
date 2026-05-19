import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedIndexQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { PageCuratedIndex } from './_components/PageCuratedIndex';

const getCachedCuratedIndexData = cache(async (locale: string) =>
	sanityFetch({
		query: pageCuratedIndexQuery,
		params: { locale },
		tags: ['pCuratedIndex', 'pCurated', 'pCuratedCategory', 'pCuratedCollection'],
	})
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedCuratedIndexData(locale);
	return defineMetadata({ data: stegaClean(data) });
}

export default async function Page(props: Props) {
	const { locale } = await props.params;
	const { data } = await getCachedCuratedIndexData(locale);

	if (!data) return notFound();

	return <PageCuratedIndex data={data} />;
}
