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
		</SectionShell>
	);
}
