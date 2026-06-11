import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { type Locale, localizePath } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductsAllQuery } from '@/sanity/lib/queries';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
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

	const dict = await getDictionary(locale);
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale }) },
		{ name: dict.breadcrumb.products, path: resolveHref({ documentType: 'pProductIndex', locale }) },
		{ name: dict.products.allProducts, path: localizePath('/products/all', locale) },
	]);

	return (
		<>
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageProductsAll data={data} />
		</>
	);
}
