'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { revealStagger } from '@/lib/animate';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight } from '@/components/SvgIcons';
import ProductCardAddToCart from '@/components/ProductCardAddToCart';
import type { CardAddToCart } from '@/lib/shopify/types';

type ProductCardProps = {
	product: {
		_id: string;
		slug?: string | null;
		title?: string | null;
		badge?: string[] | null;
		price?: string | null;
		brands?: Array<{ _id: string; title?: string | null }> | null;
		mainImage?: any;
		/**
		 * Quick-add descriptor, written onto the card by `applyCardPrices` when
		 * Shopify resolved the handle and the product is simple enough to sell
		 * from a card. Absent for an unlinked product, an unreachable or
		 * unconfigured Shopify, and anything with two or more option groups — all
		 * of which keep the plain "View" affordance.
		 */
		addToCart?: CardAddToCart | null;
		/** Live Shopify availability — never `pProduct.soldOut`, which is the
		 * detail page's editorial override and is not projected onto cards. */
		outOfStock?: boolean | null;
	};
	index?: number;
	/**
	 * Marks this card's image as the LCP candidate: `fetchpriority="high"` and no
	 * lazy-loading. Exactly one image per page should get it — the first one in
	 * the viewport. Every card image is `loading="lazy"` without this, which is
	 * what left /products with zero prioritized images and ~745ms of LCP load
	 * delay. The caller decides which card qualifies (see PageProductIndex).
	 */
	priority?: boolean;
	/**
	 * The `sizes` attribute for the card image, when this grid is not the
	 * standard one `DEFAULT_CARD_SIZES` describes. The card cannot derive this:
	 * how many columns there are at each breakpoint, and how wide the container
	 * is, are facts only the grid holds -- and `sectionAppearance` can narrow a
	 * `productsBlock` section without the card ever seeing it.
	 *
	 * Inert on an art-directed product: `productCardFields` projects
	 * `mainImage.imageMobile`, and when that is set `ImageBlock` renders a
	 * <picture> whose <source>s carry a single full-width Sanity URL and no
	 * `sizes` at all. Pre-existing, and worth knowing before trusting a payload
	 * number measured on a product without a mobile crop.
	 */
	sizes?: string;
};

/**
 * The grid every product listing now shares: two cards up to 1024px, three to
 * 1536, four beyond, and never wider than 470px once the page hits its own max
 * width. There is no phone clause, because two-up below 640px is still half the
 * viewport -- the `100vw` this carried until the grids went two-up at base was
 * asking for an image twice as wide as the slot on every phone.
 *
 * Two call sites are shaped differently and pass their own: the cart drawer
 * (a fixed 416px panel) and the collection page (four-up at `xl`, not `2xl`).
 */
const DEFAULT_CARD_SIZES =
	'(max-width: 1024px) 50vw, (max-width: 1536px) 33vw, (min-width: 2000px) 470px, 25vw';

export default function ProductCard({
	product,
	index = 0,
	priority = false,
	sizes,
}: ProductCardProps) {
	const locale = useLocale();
	const t = useTranslations('products');
	const brandLabel = product.brands
		?.map((b) => b.title)
		.filter(Boolean)
		.join(', ');

	return (
		<article
			className="reveal group relative flex h-full flex-col"
			style={revealStagger(index)}
		>
			<div className="relative aspect-square overflow-hidden bg-background rounded">
				{product.badge && product.badge.length > 0 && (
					// Absolute at every breakpoint. In flow it is a sibling of an
					// `h-full` image inside this `aspect-square overflow-hidden` box,
					// so its own height pushed the image down and the frame clipped
					// the same amount off the bottom.
					//
					// `z-10` is required, not decorative, because this sits BEFORE the
					// image in the DOM: the image takes a transform on group-hover,
					// which makes it paint as its own stacking context at level 0, and
					// an auto-z-index badge would then be painted underneath it for as
					// long as the pointer is over the card.
					<div className="absolute top-4 left-0 z-10 flex flex-col items-start gap-1.5">
						{product.badge.map((b) => (
							<Badge key={b}>
								{(t.badges as Record<string, string>)[b] ?? b}
							</Badge>
						))}
					</div>
				)}
				{product.mainImage ? (
					<ImageBlock
						className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:-translate-y-2 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
						imageObj={product.mainImage}
						alt={product.title ?? ''}
						sizes={sizes ?? DEFAULT_CARD_SIZES}
						priority={priority}
					/>
				) : (
					<div className="h-full w-full" />
				)}
			</div>

			{/* Info */}
			<div className="mt-4 flex flex-1 flex-col space-y-2">
				{brandLabel && (
					// `t-b-1` (14px) replaces `t-b-2 sm:text-sm`, which was 12px on
					// mobile and 14px above `sm`. Desktop is unchanged; mobile grows to
					// match it. One token, not a token plus a breakpoint override -- the
					// note on the title below says why that pairing misfires here.
					<p className="t-b-1 text-foreground">{brandLabel}</p>
				)}
				{product.title && (
					// One type token, no raw `text-*` override beside it. The .t-* classes
					// live in @layer components rather than being @utility, so a `sm:text-*`
					// utility beside one wins on layer order for font-size alone and leaves
					// the token's weight and tracking in place -- a hybrid matching no token
					// in globals.css.
					//
					// `t-l-0` runs 16->17px and `t-l-1` 12->13px, and they are NOT otherwise
					// identical: `t-l-0` is line-height 1.2 / tracking -0.02em against
					// `t-l-1`'s 1.25 / +0.02em, since the label rungs opened their tracking
					// up when the ladder was rebuilt. So this is not purely a size change --
					// `t-l-1 sm:text-base` was 16px above `sm` but carried the label
					// tracking with it. At the ~163-184px a card gets in the two-up grid the
					// title wants the tighter heading tracking, which is `t-l-0`'s.
					<h3 className="t-l-0 line-clamp-2 text-balance uppercase">
						{product.title}
					</h3>
				)}

				<div className="mt-auto flex items-baseline justify-between gap-3">
					<span className="t-spec text-foreground font-semibold">
						{product.price ?? ''}
					</span>
					{/* Three states, in precedence order: sell it, say it is gone, or
					    fall back to the link the whole card already is. The sold-out
					    line is NOT aria-hidden, unlike the "View" branch: that one is
					    decoration for a link the overlay anchor already names, while
					    this is the only place a card says a product cannot be bought.
					    It carries no hover for the same reason -- a state change with
					    nothing behind it is a false affordance. */}
					{product.addToCart ? (
						<ProductCardAddToCart
							addToCart={product.addToCart}
							productTitle={product.title ?? ''}
						/>
					) : product.outOfStock ? (
						<span className="t-l-2 uppercase text-foreground/45">
							{t.soldOut}
						</span>
					) : (
						<span
							aria-hidden
							className="t-l-2 inline-flex items-center gap-1 uppercase text-foreground/65 transition-colors duration-200 group-hover:text-accent-foreground"
						>
							{t.view}
							<span className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
								<ArrowRight className="size-[1.1em]" />
							</span>
						</span>
					)}
				</div>
			</div>

			{/* Stretched overlay link: covers the whole card so any neutral area
			   navigates to the product. Its `z-0` is load-bearing, not tidy-up
			   fodder: the quick-add trigger in the footer is `relative z-10` and
			   has to stay above this to take its own clicks. Avoids nesting <a>
			   inside <a>. */}
			<Link
				href={
					resolveHref({
						documentType: 'pProduct',
						slug: product.slug,
						locale,
					})!
				}
				className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				<span className="sr-only">{product.title}</span>
			</Link>
		</article>
	);
}
