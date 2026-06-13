import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { type Locale, LOCALES } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductCategoriesIndexQuery } from '@/sanity/lib/queries';
import defineMetadata from '@/lib/defineMetadata';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
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

	if (!data) return <NotFoundContent locale={locale} />;

	const dict = await getDictionary(locale);
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale }) },
		{ name: dict.breadcrumb.products, path: resolveHref({ documentType: 'pProductIndex', locale }) },
		{ name: dict.products.categoriesTitle, path: resolveHref({ documentType: 'pProductCategoriesIndex', locale }) },
	]);

	return (
		<>
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageProductCategoriesIndex data={data} />
		</>
	);
}
