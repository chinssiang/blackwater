import { stegaClean } from '@sanity/client/stega';
import ProductCard from '@/components/ProductCard';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { MAX_WIDTH_PX } from '@/lib/section-appearance';
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

/**
 * The card `sizes` for this grid when `sectionAppearance` narrows the section.
 * `ProductCard`'s default describes a full-width page grid, and the card cannot
 * see the cap -- so a narrowed section would ask for a quarter of the VIEWPORT
 * to fill a quarter of a 768px box.
 *
 * `min()` rather than a flat px figure because the cap is a ceiling, not a
 * width: below it the section is still viewport-wide, and swapping the vw term
 * out entirely would over-request on phones -- the same mistake the default's
 * removed `100vw` clause was.
 *
 * The gap terms match the grid below (`gap-x-6`, `2xl:gap-x-10`), and the
 * breakpoints match its columns: two up, three at `lg`, four at `2xl`.
 */
function narrowedCardSizes(maxWidth: unknown): string | undefined {
	const key = stegaClean(maxWidth) as keyof typeof MAX_WIDTH_PX;
	const cap = MAX_WIDTH_PX[key];
	if (!cap) return undefined;

	const slot = (cols: number, gap: number) =>
		Math.ceil((cap - gap * (cols - 1)) / cols);

	return [
		`(max-width: 1024px) min(50vw, ${slot(2, 24)}px)`,
		`(max-width: 1536px) min(33vw, ${slot(3, 24)}px)`,
		`min(25vw, ${slot(4, 40)}px)`,
	].join(', ');
}

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
						sizes={narrowedCardSizes(sectionAppearance?.maxWidth)}
						// Deliberately no `priority`: exactly one image per page is the LCP
						// candidate, and this module has no idea whether the page above it
						// already claimed that. Guessing here would demote the real one.
					/>
				))}
			</div>
		</SectionShell>
	);
}
