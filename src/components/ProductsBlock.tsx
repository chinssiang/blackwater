import ProductCard from '@/components/ProductCard';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { withLiveCardPrices } from '@/lib/shopify/product';
import type { Locale } from '@/lib/i18n';

// Sanity's GROQ arm has already picked the products (hand-picked list or
// collection, decided there so the discriminator never reaches the client); this
// adds live prices and the grid, the same split ProductRelatedGrid uses.

type Card = { _id: string; shopifyHandle?: string | null } & Record<
	string,
	unknown
>;

type ProductsBlockProps = {
	data: {
		heading?: string;
		limit?: number | null;
		products?: Card[] | null;
		sectionAppearance?: SectionAppearance;
	};
	locale: Locale;
	headingLevel?: 'h1' | 'h2';
	className?: string;
};

const DEFAULT_PRODUCT_LIMIT = 4;

export default async function ProductsBlock({
	data,
	locale,
	headingLevel,
	className,
}: ProductsBlockProps) {
	const { heading, products, limit, sectionAppearance } = data || {};

	// Sliced before the Storefront lookup, so it asks about exactly the handles
	// that will render. `?? `, not `||`: a stored 0 means the editor asked for none.
	const cards = (products ?? []).slice(0, limit ?? DEFAULT_PRODUCT_LIMIT);
	if (cards.length === 0) return null;

	const priced = await withLiveCardPrices(cards, locale);

	return (
		<SectionShell
			appearance={sectionAppearance}
			heading={heading}
			headingLevel={headingLevel}
			className={className}
		>
			<div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10">
				{priced.map((product, index) => (
					<ProductCard
						key={product._id}
						product={
							product as React.ComponentProps<typeof ProductCard>['product']
						}
						index={index}
						compact={true}
						// Two-up from the phone up, unlike every other product grid,
						// so the default's `(max-width: 640px) 100vw` would fetch an
						// image twice as wide as the slot -- four times the pixels --
						// on every phone.
						sizes="(max-width: 1024px) 50vw, (max-width: 1536px) 33vw, (min-width: 2000px) 470px, 25vw"
						// Deliberately no `priority`: exactly one image per page is the LCP
						// candidate, and this module has no idea whether the page above it
						// already claimed that. Guessing here would demote the real one.
					/>
				))}
			</div>
		</SectionShell>
	);
}
