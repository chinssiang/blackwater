import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Locale } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedCollectionsIndexQuery } from '@/sanity/lib/queries';
import { PageCuratedCollectionsIndex } from './_components/PageCuratedCollectionsIndex';

const getCachedData = cache((locale: Locale) =>
	sanityFetch({
		query: pageCuratedCollectionsIndexQuery,
		params: { locale },
		tags: ['pCuratedCollection'],
	})
);

export const metadata: Metadata = {
	title: 'Curated Collections',
};

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
	const { locale } = await params;
	const { data } = await getCachedData(locale);

	if (!data) return notFound();

	return <PageCuratedCollectionsIndex data={data} />;
}
