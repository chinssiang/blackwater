import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageCuratedCategorySingleQuery,
	pageCuratedCategorySlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
import { type Locale } from '@/lib/i18n';
import PageCuratedCategory from './_components/PageCuratedCategory';

type Props = {
	params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageCuratedCategorySlugsQuery,
		perspective: 'published',
		stega: false,
	});
	return data ?? [];
}

const getCachedCategoryData = cache(async (slug: string, locale: string) =>
	sanityFetch({
		query: pageCuratedCategorySingleQuery,
		params: { slug, locale },
		tags: ['pCuratedCategory', 'pCurated'],
	})
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug, locale } = await params;
	const { data } = await getCachedCategoryData(slug, locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function Page({ params }: Props) {
	const { slug, locale } = await params;
	const { data } = await getCachedCategoryData(slug, locale);

	if (!data) return notFound();

	const cleanData = stegaClean(data);
	const dict = await getDictionary(locale as Locale);
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale: locale as Locale }) },
		{ name: dict.breadcrumb.curated, path: resolveHref({ documentType: 'pCuratedIndex', locale: locale as Locale }) },
		{ name: cleanData?.title, path: resolveHref({ documentType: 'pCuratedCategory', slug, locale: locale as Locale }) },
	]);

	return (
		<>
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageCuratedCategory data={data} />
		</>
	);
}
