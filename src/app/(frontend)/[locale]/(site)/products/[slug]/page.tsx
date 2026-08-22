import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache, Suspense } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageProductSingleQuery,
	pageProductSlugsQuery,
} from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import { type Locale } from '@/lib/i18n';
import { isShopifyConfigured } from '@/lib/shopify/client';
import PageProductSingle from './_components/PageProductSingle';
import ProductBuyColumn from './_components/ProductBuyColumn';
import ProductGalleryColumn from './_components/ProductGalleryColumn';
import ProductMainImage from './_components/ProductMainImage';
import ProductRelatedGrid from './_components/ProductRelatedGrid';
import { BuyColumnSkeleton } from './_components/BuyColumn';

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
		// gTag: metadata lists deref @-> into gTag; pBrand: productCardFields
		// derefs brands[]->.
		tags: ['pProduct', 'pProductCategory', 'gSizeChart', 'gTag', 'pBrand'],
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

	const firstCategory = data.categories?.[0];

	// Only show the buy-column placeholder when there is actually a Storefront
	// lookup to wait for. `getProductCommerce` returns null without a network
	// call for an unlinked product, and `isShopifyConfigured()` short-circuits
	// the same way wherever the env vars are unset — in both cases BuyColumn
	// resolves to a bare manual price, so a skeleton showing a price line, five
	// size chips and a full-width button would promise controls that never come
	// and then collapse to one line of text.
	const awaitsCommerce = Boolean(
		stegaClean(data.shopifyHandle) && isShopifyConfigured()
	);

	// Picked rather than spread: `data` also holds both related arrays, the SEO
	// `sharing` block, `availableLocales` and every commerce field, none of which
	// PageProductSingle renders — and all of which would otherwise be serialized
	// across the client boundary on every product page.
	const {
		title,
		badge,
		categories,
		brands,
		content,
		whyUseIt,
		whoIsItFor,
		whenReachForIt,
		metadata,
		sizeChart,
	} = data;

	// Cleaned once for both hero renders below, the same way ProductGalleryColumn
	// cleans it for the gallery: this feeds alt text, and in draft mode the title
	// carries invisible stega characters that would ship to the a11y tree.
	const imageAlt = stegaClean(title) ?? '';

	// Every Shopify lookup streams. Awaiting them here put Storefront round trips
	// in front of the first byte, delaying content Sanity had already returned.
	// Each boundary soft-fails to the manual Sanity fields on its own. The buy
	// column and the gallery read the same cache()d fetch, so the pair costs one
	// round trip — which is also why both are handed `data.shopifyHandle`
	// untouched: cache() keys on argument identity.
	return (
		<PageProductSingle
			data={{
				title,
				badge,
				categories,
				brands,
				content,
				whyUseIt,
				whoIsItFor,
				whenReachForIt,
				metadata,
				sizeChart,
			}}
			gallerySlot={
				awaitsCommerce ? (
					<Suspense
						fallback={
							<ProductMainImage imageObj={data.mainImage} alt={imageAlt} />
						}
					>
						<ProductGalleryColumn
							handle={data.shopifyHandle}
							locale={locale as Locale}
							mainImage={data.mainImage}
							title={title}
						/>
					</Suspense>
				) : (
					// Nothing to wait for, so this is the real LCP element.
					<ProductMainImage imageObj={data.mainImage} alt={imageAlt} priority />
				)
			}
			buySlot={
				<Suspense fallback={awaitsCommerce ? <BuyColumnSkeleton /> : null}>
					<ProductBuyColumn
						handle={data.shopifyHandle}
						locale={locale as Locale}
						price={data.price}
						purchaseLink={data.purchaseLink}
						soldOut={data.soldOut}
						title={data.title}
						slug={data.slug}
					/>
				</Suspense>
			}
			relatedSlot={
				// No fallback: the grid is below the fold and its heading would be a
				// promise of content that may not exist (both arrays can be empty).
				<Suspense fallback={null}>
					<ProductRelatedGrid
						relatedProducts={data.relatedProducts as any}
						defaultRelatedProducts={data.defaultRelatedProducts as any}
						locale={locale as Locale}
						categoryTitle={firstCategory?.title}
						categorySlug={firstCategory?.slug}
					/>
				</Suspense>
			}
		/>
	);
}
