import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { type Locale, LOCALES } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageCuratedCategoriesIndexQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { getDictionary } from '@/lib/dictionary.server';
import { PageCuratedCategoriesIndex } from './_components/PageCuratedCategoriesIndex';

const getCachedData = cache((locale: Locale) =>
	sanityFetch({
		query: pageCuratedCategoriesIndexQuery,
		params: { locale },
		tags: ['pCuratedCategory', 'pCurated'],
	})
);

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const dict = await getDictionary(locale);
	const { data } = await getCachedData(locale);
	const clean = stegaClean(data);
	return defineMetadata({
		data: {
			_type: 'pCuratedCategoriesIndex',
			title: dict.curated.categoriesTitle,
			sharing: {
				...clean?.sharing,
				metaDesc: dict.curated.categoriesDescription,
			},
		},
		locale,
		availableLocales: [...LOCALES],
	});
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
	const { locale } = await params;
	const { data } = await getCachedData(locale);

	if (!data) return notFound();

	return <PageCuratedCategoriesIndex data={data} />;
}
