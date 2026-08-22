import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { type Locale, LOCALES, localizePath } from '@/lib/i18n';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductsAllQuery } from '@/sanity/lib/queries';
import defineMetadata, { notFoundMetadata } from '@/lib/defineMetadata';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import { resolveHref } from '@/lib/routes';
import { getDictionary } from '@/lib/dictionary.server';
import JsonLd from '@/components/JsonLd';
import { withLiveCardPrices } from '@/lib/shopify/product';
import { PageProductsAll } from './_components/PageProductsAll';

const PAGE_SIZE = 24;

const getCachedData = cache((locale: Locale, start: number, end: number) =>
	sanityFetch({
		query: pageProductsAllQuery,
		params: { locale, start, end },
		// pBrand: productCardFields derefs brands[]->.
		tags: ['pProduct', 'pProductCategory', 'pBrand'],
	})
);

// Was a static English-only `metadata` export: no canonical, no hreflang, and
// identical for every ?page=N — so each paginated URL was a separately
// indexable duplicate serving an English title on the zh route. Paginated pages
// self-canonicalize (Google's guidance): page 2 is its own page, not a
// near-duplicate of page 1, so its canonical carries the ?page= parameter.
export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ locale: Locale }>;
	searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
	const [{ locale }, { page: pageParam }] = await Promise.all([
		params,
		searchParams,
	]);
	const dict = await getDictionary(locale);
	const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);

	// Beyond the last page the component below renders NotFoundContent at HTTP
	// 200, so this must de-index rather than emit a canonical that legitimises an
	// unbounded ?page= space. Same cache() call and arguments as the component,
	// so this costs no extra fetch.
	const start = (page - 1) * PAGE_SIZE;
	const { data: pageData } = await getCachedData(locale, start, start + PAGE_SIZE);
	const totalPages = Math.max(1, Math.ceil((pageData?.total ?? 0) / PAGE_SIZE));
	if (!pageData || page > totalPages) return notFoundMetadata();

	const base = defineMetadata({
		data: {
			_type: 'pProductsAllIndex',
			title: dict.products.allProducts,
			sharing: { metaDesc: dict.products.allProductsDescription },
		},
		locale,
		availableLocales: [...LOCALES],
	});

	if (page === 1) return base;

	const pagedPath = `${localizePath('/products/all', locale)}?page=${page}`;
	return {
		...base,
		title: `${dict.products.allProducts} — ${page}`,
		alternates: {
			// Only the canonical is per-page. The hreflang map keeps pointing at the
			// unparameterized URLs: alternates describe the same content in another
			// language, and page N's counterpart is page N there too — but nothing
			// guarantees the two locales paginate identically, since a product
			// untranslated in one locale shifts every later page.
			canonical: `${process.env.SITE_URL}${pagedPath}`,
		},
	};
}

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

	// Independent: the dictionary is a local import, the card prices are a
	// Storefront round trip. Awaiting them in sequence put the whole dictionary
	// load in front of the network call for no reason.
	const [dict, products] = await Promise.all([
		getDictionary(locale),
		withLiveCardPrices(data.products, locale),
	]);

	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{ name: dict.breadcrumb.home, path: resolveHref({ documentType: 'pHome', locale }) },
		{ name: dict.breadcrumb.products, path: resolveHref({ documentType: 'pProductIndex', locale }) },
		{ name: dict.products.allProducts, path: localizePath('/products/all', locale) },
	]);

	return (
		<>
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageProductsAll
				data={{ ...data, products }}
				currentPage={page}
				totalPages={totalPages}
				total={data.total ?? 0}
			/>
		</>
	);
}
