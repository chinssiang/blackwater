'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { revealStagger } from '@/lib/animate';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { Badge } from '@/components/ui/Badge';
import { ArrowRight } from '@/components/SvgIcons';

type Category = { _id: string; title?: string | null; slug?: string | null };

type ProductCardProps = {
	product: {
		_id: string;
		slug?: string | null;
		title?: string | null;
		badge?: string[] | null;
		excerpt?: string | null;
		price?: string | null;
		categories?: Array<Category> | null;
		brands?: Array<{ _id: string; title?: string | null }> | null;
		mainImage?: any;
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

// Renders each category title as its own link to its category page, separated
// by ", ". Sits above the card's stretched overlay link (relative z-10) so the
// individual links stay clickable. Categories without a slug fall back to text.
function CategoryLinks({
	categories,
	className,
}: {
	categories: Category[];
	className?: string;
}) {
	const locale = useLocale();
	return (
		<p className={className}>
			{categories.map((c, i) => (
				<Fragment key={c._id}>
					{i > 0 && ', '}
					{c.slug ? (
						<Link
							href={
								resolveHref({
									documentType: 'pProductCategory',
									slug: c.slug,
									locale,
								})!
							}
							// py-2 is the tap target, not decoration: `.t-spec` is
							// 11px/1, so the bare inline box was 11px against WCAG's 24px
							// minimum. Vertical padding on an inline element grows the hit
							// area without disturbing the ", " separated line flow (inline
							// boxes ignore vertical padding when sizing the line). py-1.5
							// lands on 23px — one pixel short — so this is py-2 → 27px.
							className="relative z-10 py-2 underline-offset-4 duration-200 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
						>
							{c.title}
						</Link>
					) : (
						c.title
					)}
				</Fragment>
			))}
		</p>
	);
}

export default function ProductCard({
	product,
	index = 0,
	priority = false,
	sizes,
}: ProductCardProps) {
	const locale = useLocale();
	const t = useTranslations('products');
	const categories = product.categories?.filter((c) => Boolean(c.title)) ?? [];
	const hasCategories = categories.length > 0;
	const brandLabel = product.brands
		?.map((b) => b.title)
		.filter(Boolean)
		.join(', ');
	// Brand leads the meta. When there's no brand, the categories step up as the
	// kicker so the top line is never empty; otherwise categories are demoted
	// below the title (the tag slot).
	const showCategoryTag = Boolean(brandLabel && hasCategories);

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
			<div className="mt-4 flex flex-1 flex-col space-y-3">
				<div className="flex gap-2 justify-between sm:items-center flex-col sm:flex-row">
					{brandLabel ? (
						// `t-b-1` (14px) replaces `t-b-2 sm:text-sm`, which was 12px on
						// mobile and 14px above `sm`. Desktop is unchanged; mobile grows to
						// match it. One token, not a token plus a breakpoint override -- the
						// note on the title below says why that pairing misfires here.
						//
						// No `whitespace-nowrap` either: the grid is two-up on mobile, so
						// this shares roughly 163px with the price, and a brand like "New
						// Balance Redux" has to be allowed to wrap.
						<p className="t-b-1 flex-1 text-foreground">{brandLabel}</p>
					) : (
						hasCategories && (
							<CategoryLinks
								categories={categories}
								// -my-2 py-2 matches the anchor's padding so the enlarged tap
								// target stays inside this row's own box instead of
								// overhanging into blank card space, where it would sit above
								// the card's stretched overlay link and steal its clicks. The
								// negative margin keeps the visual rhythm unchanged.
								className="t-spec -my-2 flex-1 py-2 uppercase text-foreground"
							/>
						)
					)}
					{showCategoryTag && (
						<CategoryLinks
							categories={categories}
							// /60 not /50: on the force-light product routes the
							// background is #f2f2f2, where foreground/50 lands on
							// #7e7e7e = 3.63:1 and fails AA. /60 is #676767 = 5.0:1.
							// That arithmetic holds for those routes only -- inside a
							// SectionShell both the ink and the ground are the
							// editor's, and no alpha can promise a ratio there.
							className="t-spec -my-2 py-2 uppercase text-foreground/60"
						/>
					)}
				</div>
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

				{/* Footer alignment is the parent flex column plus `mt-auto` below,
				    not this -- it has to be, since the brand line above alternates
				    between two rungs of different heights. What the reserved two
				    lines still buy is the gap ABOVE the footer: without it a
				    one-line excerpt leaves a ragged band of whitespace next to a
				    two-line neighbour in the same row. */}
				<p className="t-b-2 line-clamp-2 min-h-[2lh] max-w-[42ch] leading-snug text-foreground/60">
					{product.excerpt}
				</p>

				<div className="mt-auto flex items-baseline justify-between gap-3">
					<span className="t-spec text-foreground font-semibold">
						{product.price ?? ''}
					</span>
					<span
						aria-hidden
						className="t-l-2 inline-flex items-center gap-1 uppercase text-foreground/65 transition-colors duration-200 group-hover:text-accent-foreground"
					>
						{t.view}
						<span className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
							<ArrowRight className="size-[1.1em]" />
						</span>
					</span>
				</div>
			</div>

			{/* Stretched overlay link: covers the whole card so any neutral area
			   navigates to the product, while the category links above (z-10)
			   stay individually clickable. Avoids nesting <a> inside <a>. */}
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
