import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Locale } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedProductsIndexQuery } from '@/sanity/lib/queries';
import { PageCuratedProductsIndex } from './_components/PageCuratedProductsIndex';

const getCachedData = cache((locale: Locale) =>
	sanityFetch({
		query: pageCuratedProductsIndexQuery,
		params: { locale },
		tags: ['pCurated', 'pCuratedCategory'],
	})
);

export const metadata: Metadata = {
	title: 'Curated Products',
};

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
	const { locale } = await params;
	const { data } = await getCachedData(locale);

	if (!data) return notFound();

	return <PageCuratedProductsIndex data={data} />;
}
