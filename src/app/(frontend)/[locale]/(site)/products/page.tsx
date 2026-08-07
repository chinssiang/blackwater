import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pageProductIndexQuery } from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import { LOCALES, type Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionary.server';
import { applyCardPrices, getCardCommerce } from '@/lib/shopify/product';
import { PageProductIndex } from './_components/PageProductIndex';

// Prerender both locale variants at build time so the heavy per-category
// count() GROQ query stays out of the request path (mirrors the detail route,
// which prerenders + relies on tag-based revalidation via /revalidate-tag).
export function generateStaticParams() {
	return LOCALES.map((locale) => ({ locale }));
}

const getCachedProductIndexData = cache(async (locale: string) =>
	sanityFetch({
		query: pageProductIndexQuery,
		params: { locale },
		tags: ['pProductIndex', 'pProduct', 'pProductCategory', 'pProductCollection'],
	})
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedProductIndexData(locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function Page(props: Props) {
	const { locale } = await props.params;
	const { data } = await getCachedProductIndexData(locale);

	if (!data) return <NotFoundContent locale={locale} />;

	// One batched Shopify lookup covers the "all products" grid and every
	// collection strip; each array is then re-priced from the same map.
	const [cardCommerce, dict] = await Promise.all([
		getCardCommerce(
			[
				...(data.allProductsList ?? []).map((p) => p.shopifyHandle),
				...(data.collections ?? []).flatMap(
					(c) => c?.products?.map((p) => p.shopifyHandle) ?? []
				),
			],
			locale as Locale
		),
		getDictionary(locale as Locale),
	]);

	const pricedData = {
		...data,
		allProductsList: applyCardPrices(
			data.allProductsList,
			cardCommerce,
			locale as Locale,
			dict.products.fromPrice
		),
		collections: (data.collections ?? []).map((collection) =>
			collection
				? {
						...collection,
						products: applyCardPrices(
							collection.products,
							cardCommerce,
							locale as Locale,
							dict.products.fromPrice
						),
					}
				: collection
		),
	};

	return <PageProductIndex data={pricedData} />;
}
