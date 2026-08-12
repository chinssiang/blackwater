import { stegaClean } from '@sanity/client/stega';
import { type Locale } from '@/lib/i18n';
import { getProductCommerce } from '@/lib/shopify/product';
import ProductGallery from './ProductGallery';
import ProductMainImage, { type ProductMainImageObj } from './ProductMainImage';

// Async boundary around the product's Storefront lookup, mirroring
// ProductBuyColumn — both read the same cache()d fetch, so the gallery costs no
// extra round trip. Rendered inside a Suspense boundary on the page whose
// fallback is the Sanity mainImage, which is also what this falls back to when
// Shopify has no images for the product.

type Props = {
	/** Passed through untouched: getProductCommerce is cache()d on this value. */
	handle: string | null | undefined;
	locale: Locale;
	mainImage: ProductMainImageObj;
	title?: string | null;
};

export default async function ProductGalleryColumn({
	handle,
	locale,
	mainImage,
	title,
}: Props) {
	const commerce = await getProductCommerce(handle, locale);
	const images = commerce?.images ?? [];
	// stegaClean here, not in the client component: the title feeds alt text, and
	// in draft mode it carries invisible characters that would ship to the a11y
	// tree. This is the last server-side point that touches it.
	const alt = stegaClean(title) ?? '';

	if (images.length === 0) {
		return <ProductMainImage imageObj={mainImage} alt={alt} priority />;
	}

	return <ProductGallery images={images} product={alt} />;
}
