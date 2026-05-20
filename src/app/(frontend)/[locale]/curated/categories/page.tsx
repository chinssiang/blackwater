import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Locale } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedCategoriesIndexQuery } from '@/sanity/lib/queries';
import { PageCuratedCategoriesIndex } from './_components/PageCuratedCategoriesIndex';

const getCachedData = cache((locale: Locale) =>
	sanityFetch({
		query: pageCuratedCategoriesIndexQuery,
		params: { locale },
		tags: ['pCuratedCategory', 'pCurated'],
	})
);

export const metadata: Metadata = {
	title: 'Curated Categories',
};

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
	const { locale } = await params;
	const { data } = await getCachedData(locale);

	if (!data) return notFound();

	return <PageCuratedCategoriesIndex data={data} />;
}
