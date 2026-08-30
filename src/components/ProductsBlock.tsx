import ProductCard from '@/components/ProductCard';
import { getDictionary } from '@/lib/dictionary.server';
import { applyCardPrices, getCardCommerce } from '@/lib/shopify/product';
import { buildRgbaCssString } from '@/lib/image-utils';
import type { Locale } from '@/lib/i18n';
import { cn, getSpacingClass } from '@/lib/utils';

// Async Server Component that owns its own Storefront lookup, modelled on
// ProductRelatedGrid — the only other listing that does. Sanity's GROQ arm has
// already picked the products (hand-picked list or collection, decided there so
// the discriminator never reaches the client); this adds live prices and the
// grid.
//
// The cards themselves stay Shopify-unaware: applyCardPrices returns copies with
// only `price` rewritten, and an outage or an unknown handle leaves the manual
// Sanity price in place rather than failing the page.

type MaxWidthType = 'none' | 'xl' | 'l' | 'm' | 's' | 'xs';

type Card = { _id: string; shopifyHandle?: string | null } & Record<
	string,
	unknown
>;

type ProductsBlockProps = {
	data: {
		heading?: string;
		limit?: number | null;
		products?: Card[] | null;
		sectionAppearance?: any;
	};
	locale: Locale;
	className?: string;
};

const DEFAULT_PRODUCT_LIMIT = 4;

export default async function ProductsBlock({
	data,
	locale,
	className,
}: ProductsBlockProps) {
	const { heading, products, sectionAppearance } = data || {};

	// `?? DEFAULT`, not `||`: a stored 0 means the editor asked for none.
	const cards = (products ?? []).slice(0, data?.limit ?? DEFAULT_PRODUCT_LIMIT);
	if (cards.length === 0) return null;

	// Started together, not sequenced — the dictionary is a local import and has
	// no reason to sit behind the Storefront round trip.
	const [cardCommerce, dict] = await Promise.all([
		getCardCommerce(
			cards.map((product) => product.shopifyHandle),
			locale
		),
		getDictionary(locale),
	]);
	const priced = applyCardPrices(
		cards,
		cardCommerce,
		locale,
		dict.products.fromPrice
	);

	const {
		backgroundColor,
		textColor,
		textAlign = 'text-left',
		maxWidth = 'none',
		spacingTop,
		spacingBottom,
		spacingTopDesktop,
		spacingBottomDesktop,
	} = (sectionAppearance as {
		backgroundColor?: any;
		textColor?: any;
		textAlign?: string;
		maxWidth?: MaxWidthType;
		spacingTop?: any;
		spacingBottom?: any;
		spacingTopDesktop?: any;
		spacingBottomDesktop?: any;
	}) || {};

	const hasBackground = !!backgroundColor;

	const spacingClasses = [
		getSpacingClass('marginTop', spacingTop, hasBackground),
		getSpacingClass('marginBottom', spacingBottom, hasBackground),
		getSpacingClass('marginTopDesktop', spacingTopDesktop, hasBackground),
		getSpacingClass('marginBottomDesktop', spacingBottomDesktop, hasBackground),
	].filter(Boolean);

	// Freeform's key set, not FaqBlock's: sectionAppearance only ever emits
	// none|xl|l|m|s|xs, so FaqBlock's `lg`/`md` keys are unreachable.
	const maxWidthClasses =
		(
			{
				none: 'w-full',
				xl: 'max-w-7xl',
				l: 'max-w-5xl',
				m: 'max-w-3xl',
				s: 'max-w-xl',
				xs: 'max-w-xs',
			} as const
		)[maxWidth] || 'w-full';

	return (
		<section
			className={cn(
				'px-contain mx-auto',
				textAlign,
				maxWidthClasses,
				...spacingClasses,
				className
			)}
			style={{
				color: buildRgbaCssString(textColor) || 'inherit',
				backgroundColor: buildRgbaCssString(backgroundColor) || undefined,
			}}
		>
			{heading && <h2 className="t-h-3 mb-6 uppercase">{heading}</h2>}

			<div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
				{priced.map((product, index) => (
					<ProductCard
						key={product._id}
						product={
							product as React.ComponentProps<typeof ProductCard>['product']
						}
						index={index}
						// Deliberately no `priority`: exactly one image per page is the LCP
						// candidate, and this module has no idea whether the page above it
						// already claimed that. Guessing here would demote the real one.
					/>
				))}
			</div>
		</section>
	);
}
