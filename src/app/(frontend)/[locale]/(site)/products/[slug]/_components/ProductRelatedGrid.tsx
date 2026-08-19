import Link from 'next/link';
import { type Locale, localizePath } from '@/lib/i18n';
import { interpolate } from '@/lib/dictionary';
import { getDictionary } from '@/lib/dictionary.server';
import { applyCardPrices, getCardCommerce } from '@/lib/shopify/product';
import { resolveHref } from '@/lib/routes';
import ProductCard from '../../_components/ProductCard';

// Async boundary around the related grid's Storefront lookup. It sits below the
// fold, so it belongs behind its own Suspense boundary rather than on the
// critical path — and it has to be one, not just the buy column: both fetches
// used to share a single Promise.all, so streaming only the buy column would
// have left this one blocking the page and bought nothing.
//
// Choosing between the two related arrays happens *here*, on the server. Doing
// it in the client component meant both were serialized into the RSC payload on
// every product page while only one was ever rendered, and it made the card
// price lookup ask Shopify about handles from both.

type Card = { _id: string; shopifyHandle?: string | null } & Record<
	string,
	unknown
>;

type Props = {
	relatedProducts?: Card[] | null;
	defaultRelatedProducts?: Card[] | null;
	locale: Locale;
	categoryTitle?: string | null;
	categorySlug?: string | null;
};

export default async function ProductRelatedGrid({
	relatedProducts,
	defaultRelatedProducts,
	locale,
	categoryTitle,
	categorySlug,
}: Props) {
	const related =
		relatedProducts && relatedProducts.length > 0
			? relatedProducts
			: defaultRelatedProducts;
	if (!related || related.length === 0) return null;

	const [cardCommerce, dict] = await Promise.all([
		getCardCommerce(
			related.map((p) => p.shopifyHandle),
			locale
		),
		getDictionary(locale),
	]);
	const products = applyCardPrices(
		related,
		cardCommerce,
		locale,
		dict.products.fromPrice
	);

	return (
		<section className="mx-max border-t border-foreground/10 pt-12 lg:pt-16">
			<div className="mb-6 flex items-baseline justify-between gap-4 lg:mb-8">
				<h2 className="t-l-2 uppercase text-foreground/70">
					{categoryTitle
						? interpolate(dict.products.moreCategory, {
								category: categoryTitle,
							})
						: dict.products.morePicks}
				</h2>
				<Link
					href={
						categorySlug
							? resolveHref({
									documentType: 'pProductCategory',
									slug: categorySlug,
									locale,
								})!
							: localizePath('/products/all', locale)
					}
					className="t-l-2 inline-flex items-center uppercase text-foreground/70 transition-colors hover:text-accent-foreground pointer-coarse:min-h-11"
				>
					{categoryTitle ?? dict.products.allProducts}
				</Link>
			</div>
			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 2xl:gap-x-10">
				{products.map((product, index) => (
					<ProductCard
						key={product._id}
						product={
							product as React.ComponentProps<typeof ProductCard>['product']
						}
						index={index}
					/>
				))}
			</div>
		</section>
	);
}
