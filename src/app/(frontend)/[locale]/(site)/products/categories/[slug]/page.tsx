import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageProductCategorySingleQuery,
	pageProductCategorySlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
import { type Locale, LOCALES } from '@/lib/i18n';
import PageProductCategory from './_components/PageProductCategory';

type Props = {
	params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageProductCategorySlugsQuery,
		perspective: 'published',
		stega: false,
	});
	return data ?? [];
}

const getCachedCategoryData = cache(async (slug: string, locale: string) =>
	sanityFetch({
		query: pageProductCategorySingleQuery,
		params: { slug, locale },
		tags: ['pProductCategory', 'pProduct'],
	})
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug, locale } = await params;
	const { data } = await getCachedCategoryData(slug, locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		// Inline-i18n category lives in one document available in every locale.
		availableLocales: [...LOCALES],
	});
}

export default async function Page({ params }: Props) {
	const { slug, locale } = await params;
	const { data } = await getCachedCategoryData(slug, locale);

	if (!data) return <NotFoundContent locale={locale} />;

	const cleanData = stegaClean(data);
	const dict = await getDictionary(locale as Locale);
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale: locale as Locale }) },
		{ name: dict.breadcrumb.products, path: resolveHref({ documentType: 'pProductIndex', locale: locale as Locale }) },
		{ name: cleanData?.title, path: resolveHref({ documentType: 'pProductCategory', slug, locale: locale as Locale }) },
	]);

	return (
		<>
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageProductCategory data={data} />
		</>
	);
}
