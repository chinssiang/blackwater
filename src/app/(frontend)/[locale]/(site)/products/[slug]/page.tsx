import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageProductSingleQuery,
	pageProductSlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import { type Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/dictionary.server';
import {
	applyCardPrices,
	getCardCommerce,
	getProductCommerce,
} from '@/lib/shopify/product';
import PageProductSingle from './_components/PageProductSingle';

type Props = {
	params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
	const { data } = await sanityFetch({
		query: pageProductSlugsQuery,
		perspective: 'published',
		stega: false,
	});
	return data ?? [];
}

const getCachedProductData = cache(async (slug: string, locale: string) =>
	sanityFetch({
		query: pageProductSingleQuery,
		params: { slug, locale },
		tags: ['pProduct', 'pProductCategory', 'gSizeChart'],
	})
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug, locale } = await params;
	const { data } = await getCachedProductData(slug, locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function Page({ params }: Props) {
	const { slug, locale } = await params;
	const { data } = await getCachedProductData(slug, locale);

	if (!data) return <NotFoundContent locale={locale} />;

	// Live Shopify data: full commerce for this product, card prices for the
	// related grids. All soft-fail to the manual Sanity fields.
	const [commerce, cardCommerce, dict] = await Promise.all([
		getProductCommerce(data.shopifyHandle, locale as Locale),
		getCardCommerce(
			[
				...(data.relatedProducts ?? []),
				...(data.defaultRelatedProducts ?? []),
			].map((p: { shopifyHandle?: string | null }) => p.shopifyHandle),
			locale as Locale
		),
		getDictionary(locale as Locale),
	]);

	const pricedData = {
		...data,
		relatedProducts: applyCardPrices(
			data.relatedProducts,
			cardCommerce,
			locale as Locale,
			dict.products.fromPrice
		),
		defaultRelatedProducts: applyCardPrices(
			data.defaultRelatedProducts,
			cardCommerce,
			locale as Locale,
			dict.products.fromPrice
		),
	};

	return <PageProductSingle data={pricedData} commerce={commerce} />;
}
