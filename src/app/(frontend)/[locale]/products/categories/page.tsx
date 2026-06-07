import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { type Locale, LOCALES } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductCategoriesIndexQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { getDictionary } from '@/lib/dictionary.server';
import { PageProductCategoriesIndex } from './_components/PageProductCategoriesIndex';

const getCachedData = cache((locale: Locale) =>
	sanityFetch({
		query: pageProductCategoriesIndexQuery,
		params: { locale },
		tags: ['pProductCategory', 'pProduct'],
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
			_type: 'pProductCategoriesIndex',
			title: dict.products.categoriesTitle,
			sharing: {
				...clean?.sharing,
				metaDesc: dict.products.categoriesDescription,
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

	return <PageProductCategoriesIndex data={data} />;
}
