import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { type Locale, LOCALES } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductCollectionsIndexQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import { getDictionary } from '@/lib/dictionary.server';
import { PageProductCollectionsIndex } from './_components/PageProductCollectionsIndex';

const getCachedData = cache((locale: Locale) =>
	sanityFetch({
		query: pageProductCollectionsIndexQuery,
		params: { locale },
		tags: ['pProductCollection'],
	})
);

// Was a static English-only `metadata` export with no canonical and no
// hreflang, so /zh_tw/products/collections served the English title as an
// indexable duplicate. Mirrors the categories index instead.
export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const [dict, { data }] = await Promise.all([
		getDictionary(locale),
		getCachedData(locale),
	]);
	const clean = stegaClean(data);
	return defineMetadata({
		data: {
			_type: 'pProductCollectionsIndex',
			title: dict.products.collectionsTitle,
			sharing: {
				...clean?.sharing,
				metaDesc: dict.products.collectionsDescription,
			},
		},
		locale,
		availableLocales: [...LOCALES],
	});
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
	const { locale } = await params;
	const { data } = await getCachedData(locale);

	if (!data) return <NotFoundContent locale={locale} />;

	return <PageProductCollectionsIndex data={data} />;
}
