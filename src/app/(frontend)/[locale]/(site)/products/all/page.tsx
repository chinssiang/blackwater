import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { type Locale, localizePath } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductsAllQuery } from '@/sanity/lib/queries';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
import { PageProductsAll } from './_components/PageProductsAll';

const PAGE_SIZE = 24;

const getCachedData = cache((locale: Locale, start: number, end: number) =>
	sanityFetch({
		query: pageProductsAllQuery,
		params: { locale, start, end },
		tags: ['pProduct', 'pProductCategory'],
	})
);

export const metadata: Metadata = {
	title: 'All Products',
};

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ locale: Locale }>;
	searchParams: Promise<{ page?: string }>;
}) {
	const { locale } = await params;
	const { page: pageParam } = await searchParams;
	const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
	const start = (page - 1) * PAGE_SIZE;
	const end = start + PAGE_SIZE;

	const { data } = await getCachedData(locale, start, end);

	if (!data) return <NotFoundContent locale={locale} />;

	const totalPages = Math.max(1, Math.ceil((data.total ?? 0) / PAGE_SIZE));
	if (page > totalPages) return <NotFoundContent locale={locale} />;

	const dict = await getDictionary(locale);
	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale }) },
		{ name: dict.breadcrumb.products, path: resolveHref({ documentType: 'pProductIndex', locale }) },
		{ name: dict.products.allProducts, path: localizePath('/products/all', locale) },
	]);

	return (
		<>
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageProductsAll
				data={data}
				currentPage={page}
				totalPages={totalPages}
				total={data.total ?? 0}
			/>
		</>
	);
}
