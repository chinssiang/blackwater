import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import type { Locale } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductCollectionsIndexQuery } from '@/sanity/lib/queries';
import { PageProductCollectionsIndex } from './_components/PageProductCollectionsIndex';

const getCachedData = cache((locale: Locale) =>
	sanityFetch({
		query: pageProductCollectionsIndexQuery,
		params: { locale },
		tags: ['pProductCollection'],
	})
);

export const metadata: Metadata = {
	title: 'Collections',
};

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
	const { locale } = await params;
	const { data } = await getCachedData(locale);

	if (!data) return <NotFoundContent locale={locale} />;

	return <PageProductCollectionsIndex data={data} />;
}
