import { cache } from 'react';
import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductsAllQuery } from '@/sanity/lib/queries';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import defineMetadata, { notFoundMetadata } from '@/lib/defineMetadata';
import { getDictionary } from '@/lib/dictionary.server';
import { LOCALES, type Locale, localizePath } from '@/lib/i18n';
import {
	type ProductFilterSearchParams,
	parseProductFilters,
} from '@/lib/productFilters';
import { resolveHref } from '@/lib/routes';
import { withLiveCardPrices } from '@/lib/shopify/product';
import JsonLd from '@/components/JsonLd';
import { PageProductsAll } from './_components/PageProductsAll';

const PAGE_SIZE = 24;

type SearchParams = { page?: string } & ProductFilterSearchParams;

// The filter params arrive as the RAW comma-separated strings, not the parsed
// arrays, and are parsed inside. cache() keys on argument identity, so an array
// argument is a fresh key on every call and generateMetadata's "same arguments,
// so this costs no extra fetch" below would silently become a second round trip.
const getCachedData = cache(
	(
		locale: Locale,
		start: number,
		end: number,
		category?: string,
		brand?: string,
		badge?: string,
		price?: string,
		sort?: string
	) => {
		const filters = parseProductFilters({
			category,
			brand,
			badge,
			price,
			sort,
		});
		return sanityFetch({
			query: pageProductsAllQuery,
			params: {
				locale,
				start,
				end,
				categories: filters.categories,
				brands: filters.brands,
				badges: filters.badges,
				priceBuckets: filters.priceBuckets,
				sort: filters.sort,
			},
			// pBrand: productCardFields derefs brands[]->, and the brand facet
			// counts products per brand document.
			tags: ['pProduct', 'pProductCategory', 'pBrand'],
		});
	}
);

const fetchArgs = (sp: SearchParams, locale: Locale, start: number) =>
	[
		locale,
		start,
		start + PAGE_SIZE,
		sp.category,
		sp.brand,
		sp.badge,
		sp.price,
		sp.sort,
	] as const;

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
	searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
	const [{ locale }, sp] = await Promise.all([params, searchParams]);
	const dict = await getDictionary(locale);
	const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

	// Beyond the last page the component below renders NotFoundContent at HTTP
	// 200, so this must de-index rather than emit a canonical that legitimises an
	// unbounded ?page= space. Same cache() call and arguments as the component,
	// so this costs no extra fetch.
	const start = (page - 1) * PAGE_SIZE;
	const { data: pageData } = await getCachedData(
		...fetchArgs(sp, locale, start)
	);
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

	// A filtered view is a slice of this page, not a page of its own, and the
	// four dimensions combine into an unbounded crawl space. So it keeps the
	// unfiltered canonical and is de-indexed — `follow` so the product links on
	// it are still crawled.
	const filters = parseProductFilters(sp);
	const isFiltered =
		filters.categories.length > 0 ||
		filters.brands.length > 0 ||
		filters.badges.length > 0 ||
		filters.priceBuckets.length > 0 ||
		filters.sort !== 'az';
	if (isFiltered) return { ...base, robots: { index: false, follow: true } };

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
	searchParams: Promise<SearchParams>;
}) {
	const { locale } = await params;
	const sp = await searchParams;
	const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
	const start = (page - 1) * PAGE_SIZE;

	const { data } = await getCachedData(...fetchArgs(sp, locale, start));

	if (!data) return <NotFoundContent locale={locale} />;

	const totalPages = Math.max(1, Math.ceil((data.total ?? 0) / PAGE_SIZE));
	if (page > totalPages) return <NotFoundContent locale={locale} />;

	const filters = parseProductFilters(sp);

	// Independent: the dictionary is a local import, the card prices are a
	// Storefront round trip. Awaiting them in sequence put the whole dictionary
	// load in front of the network call for no reason.
	const [dict, products] = await Promise.all([
		getDictionary(locale),
		withLiveCardPrices(data.products, locale),
	]);

	const breadcrumbJsonLd = defineBreadcrumbJsonLd([
		{
			name: dict.breadcrumb.home,
			path: resolveHref({ documentType: 'pHome', locale }),
		},
		{
			name: dict.breadcrumb.products,
			path: resolveHref({ documentType: 'pProductIndex', locale }),
		},
		{
			name: dict.products.allProducts,
			path: localizePath('/products/all', locale),
		},
	]);

	return (
		<>
			{breadcrumbJsonLd && <JsonLd data={breadcrumbJsonLd} />}
			<PageProductsAll
				data={{ ...data, products }}
				currentPage={page}
				totalPages={totalPages}
				total={data.total ?? 0}
				selected={{
					categories: filters.categories,
					brands: filters.brands,
					badges: filters.badges,
					priceBuckets: filters.priceBuckets,
				}}
				sort={filters.sort}
			/>
		</>
	);
}
