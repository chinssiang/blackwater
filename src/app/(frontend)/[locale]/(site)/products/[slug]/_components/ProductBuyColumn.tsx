import { type Locale } from '@/lib/i18n';
import { getProductCommerce } from '@/lib/shopify/product';
import BuyColumn from './BuyColumn';

// Async boundary around the product's Storefront lookup. Rendered inside a
// Suspense boundary on the page so the Sanity-sourced image, title and copy
// stream immediately and only this column waits on Shopify.

type Props = {
	handle: string | null | undefined;
	locale: Locale;
	price?: string | null;
	purchaseLink?: string | null;
	soldOut?: boolean | null;
	title?: string | null;
	slug?: string | null;
};

export default async function ProductBuyColumn({
	handle,
	locale,
	...rest
}: Props) {
	const commerce = await getProductCommerce(handle, locale);
	return <BuyColumn commerce={commerce} {...rest} />;
}
