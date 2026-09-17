import { cache } from 'react';
import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageProductsAllQuery,
	productFilterFacetsQuery,
} from '@/sanity/lib/queries';
import defineBreadcrumbJsonLd from '@/lib/defineBreadcrumbJsonLd';
import defineMetadata, { notFoundMetadata } from '@/lib/defineMetadata';
import { getDictionary } from '@/lib/dictionary.server';
import { LOCALES, type Locale, localizePath } from '@/lib/i18n';
import {
	type ProductFilterSearchParams,
	isProductFilterActive,
	parseProductFilters,
} from '@/lib/productFilters';
import { resolveHref } from '@/lib/routes';
import { withLiveCardPrices } from '@/lib/shopify/product';
import JsonLd from '@/components/JsonLd';
import { PageProductsAll } from './_components/PageProductsAll';

const PAGE_SIZE = 24;

// The last page number worth asking Sanity about. `page` comes from the URL and
// the real bound is `total / PAGE_SIZE`, which is only known AFTER the fetch --
// so without a ceiling `?page=999999` buys a full round trip and its own
// permanent Data Cache entry, once per crafted value, on a URL space crawlers
// do enumerate. Deliberately far above any real catalogue (24,000 products)
// rather than tuned: this is a stop on absurd input, not a page-count rule, and
// a legitimate page past it still 404s the same way via the `total` check.
const MAX_PAGE = 1000;

type SearchParams = { page?: string } & ProductFilterSearchParams;

// Two fetches, not one, and the split is along what each half's cache key can
// legitimately contain. The results depend on the filters AND on $sort and the
// page window; the facets and the category grid depend on the filters and
// nothing else. Merged, a page step or a sort change was a fresh cache key for
// the facet sweep too — roughly one full scan of pProduct per category, per
// brand and per badge/price bucket — for a byte-identical answer. See the note
// above productFilterFacetsQuery.
//
// Both take the filter params as the RAW comma-separated strings, not the
// parsed arrays, and parse inside. cache() keys on argument identity, so an
// array argument is a fresh key on every call and generateMetadata's "same
// arguments, so this costs no extra fetch" below would silently become a second
// round trip.
const getCachedProducts = cache(
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
			// pBrand: productCardFields derefs brands[]->.
			tags: ['pProduct', 'pBrand'],
		});
	}
);

const getCachedFacets = cache(
	(
		locale: Locale,
		category?: string,
		brand?: string,
		badge?: string,
		price?: string
	) => {
		const filters = parseProductFilters({ category, brand, badge, price });
		return sanityFetch({
			query: productFilterFacetsQuery,
			params: {
				locale,
				categories: filters.categories,
				brands: filters.brands,
				badges: filters.badges,
				priceBuckets: filters.priceBuckets,
			},
			// pProductCategory/pBrand: the facets select those documents and render
			// their titles, so renaming one changes what this page shows.
			tags: ['pProduct', 'pProductCategory', 'pBrand'],
		});
	}
);

/** The requested page, or null when it is out of bounds or not a page at all. */
const parsePage = (raw?: string): number | null => {
	const page = Math.max(1, parseInt(raw ?? '1', 10) || 1);
	return page > MAX_PAGE ? null : page;
};

const productArgs = (sp: SearchParams, locale: Locale, start: number) =>
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

const facetArgs = (sp: SearchParams, locale: Locale) =>
	[locale, sp.category, sp.brand, sp.badge, sp.price] as const;

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
	const page = parsePage(sp.page);
	if (page == null) return notFoundMetadata();

	// Beyond the last page the component below renders NotFoundContent at HTTP
	// 200, so this must de-index rather than emit a canonical that legitimises an
	// unbounded ?page= space. The facets are not needed for any of this, which is
	// the other half of the split's value: metadata costs the cheap query only.
	const start = (page - 1) * PAGE_SIZE;
	const { data: pageData } = await getCachedProducts(
		...productArgs(sp, locale, start)
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
	if (isProductFilterActive(parseProductFilters(sp))) {
		return { ...base, robots: { index: false, follow: true } };
	}

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
	const [{ locale }, sp] = await Promise.all([params, searchParams]);
	const page = parsePage(sp.page);
	// Checked before the fetch, so an absurd page number costs no round trip.
	if (page == null) return <NotFoundContent locale={locale} />;
	const start = (page - 1) * PAGE_SIZE;

	// Independent queries, so they overlap rather than stack.
	const [{ data }, { data: facets }] = await Promise.all([
		getCachedProducts(...productArgs(sp, locale, start)),
		getCachedFacets(...facetArgs(sp, locale)),
	]);

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
				products={products}
				facets={facets}
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
