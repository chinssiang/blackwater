'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { revealStagger } from '@/lib/animate';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { cn } from '@/lib/utils';
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
};

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
					<div className="sm:absolute sm:top-4 left-0 flex flex-col items-start gap-1.5 relative">
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
						sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, (min-width: 2000px) 470px, 25vw"
						priority={priority}
					/>
				) : (
					<div className="h-full w-full" />
				)}
			</div>

			{/* Info */}
			<div className="mt-4 flex-1 space-y-3">
				<div className="flex gap-2 justify-between sm:items-center flex-col sm:flex-row">
					{brandLabel ? (
						<p className="t-b-2 sm:text-sm flex-1 text-foreground whitespace-nowrap">
							{brandLabel}
						</p>
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
							className="t-spec -my-2 py-2 uppercase text-foreground/60"
						/>
					)}
				</div>
				{product.title && (
					<h3
						className={cn(
							't-l-1 sm:text-base line-clamp-2 text-balance uppercase'
						)}
					>
						{product.title}
					</h3>
				)}

				{/* Always reserves two lines so cards in the same row keep an
				   equal height and their footers align. */}
				<p className="t-b-2  line-clamp-2 min-h-[2lh] max-w-[42ch] leading-snug text-foreground/60">
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
