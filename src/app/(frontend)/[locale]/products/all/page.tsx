import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Locale } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductsAllQuery } from '@/sanity/lib/queries';
import { PageProductsAll } from './_components/PageProductsAll';

const getCachedData = cache((locale: Locale) =>
	sanityFetch({
		query: pageProductsAllQuery,
		params: { locale },
		tags: ['pProduct', 'pProductCategory'],
	})
);

export const metadata: Metadata = {
	title: 'All Products',
};

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
	const { locale } = await params;
	const { data } = await getCachedData(locale);

	if (!data) return notFound();

	return <PageProductsAll data={data} />;
}
