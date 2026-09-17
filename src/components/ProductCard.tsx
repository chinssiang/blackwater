'use client';

import Link from 'next/link';
import { revealStagger } from '@/lib/animate';
import { badgeLabel, sortBadges } from '@/lib/product-badges';
import { resolveHref } from '@/lib/routes';
import type { CardAddToCart } from '@/lib/shopify/types';
import ImageBlock from '@/components/ImageBlock';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import ProductCardAddToCart from '@/components/ProductCardAddToCart';
import { ArrowRight } from '@/components/SvgIcons';
import { WordmarkSvg } from '@/components/WordmarkSvg';
import { Badge } from '@/components/ui/Badge';

type ProductCardProps = {
	product: {
		_id: string;
		slug?: string | null;
		title?: string | null;
		badge?: string[] | null;
		price?: string | null;
		brands?: Array<{ _id: string; title?: string | null }> | null;
		mainImage?: any;
		addToCart?: CardAddToCart | null;
		outOfStock?: boolean | null;
	};
	index?: number;
	priority?: boolean;
	sizes?: string;
};

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
	const badges = sortBadges(product.badge);
	const href = product.slug
		? resolveHref({ documentType: 'pProduct', slug: product.slug, locale })
		: undefined;
	const linkLabel = [
		product.title,
		...badges.map((b) => badgeLabel(b, t.badges)),
	]
		.filter(Boolean)
		.join(', ');

	return (
		<article
			className="reveal group relative flex h-full flex-col"
			style={revealStagger(index)}
		>
			<div className="bg-background relative aspect-square overflow-hidden rounded">
				{badges.length > 0 && (
					// `pointer-events-none` because the rail sits at `z-10` over the
					// stretched overlay link at `z-0`: without it every chip, gap and
					// wrapped-line tail is a dead click zone on top of the photo.
					// `aria-hidden` because the chips are loose text ahead of anything
					// naming the product — the link's accessible name carries them
					// instead, so they are announced once and with an antecedent.
					<div
						aria-hidden
						className="pointer-events-none absolute top-2 left-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1"
					>
						{badges.map((b) => (
							<Badge key={b} className="px-1.5 py-1 backdrop-blur-sm">
								{badgeLabel(b, t.badges)}
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
					<div className="bg-foreground/10 flex h-full w-full items-center justify-center">
						<WordmarkSvg className="text-foreground/25 w-24" />
					</div>
				)}
			</div>

			<div className="mt-4 flex flex-1 flex-col">
				<p className="t-b-1 text-foreground line-clamp-1 min-h-lh">
					{brandLabel}
				</p>
				{product.title ? (
					<h3 className="t-l-0 mt-1 line-clamp-2 min-h-[2lh] text-balance uppercase">
						{product.title}
					</h3>
				) : (
					// Holds the title's two lines open. An empty <h3> would be a
					// heading with no text, so the reserve moves to a plain box.
					<div aria-hidden className="t-l-0 mt-1 min-h-[2lh]" />
				)}

				<div className="mt-auto flex items-baseline justify-between gap-3 pt-3">
					<span className="t-spec text-foreground font-semibold">
						{product.price ?? ''}
					</span>
					{product.addToCart ? (
						<ProductCardAddToCart
							addToCart={product.addToCart}
							productTitle={product.title ?? ''}
						/>
					) : product.outOfStock ? (
						<span className="t-l-2 text-foreground/45 uppercase">
							{t.soldOut}
						</span>
					) : (
						<span
							aria-hidden
							className="t-l-2 text-foreground/65 group-hover:text-accent-foreground inline-flex items-center gap-1 uppercase transition-colors duration-200"
						>
							{t.view}
							<span className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
								<ArrowRight className="size-[1.1em]" />
							</span>
						</span>
					)}
				</div>
			</div>

			{/* No `!` on resolveHref: it interpolates the slug into a template, so a
			    product with no slug yields the truthy `/products/undefined` rather
			    than the undefined the assertion promised, and the whole card linked
			    to a 404. The accessible name carries the badges, which are
			    `aria-hidden` in the rail above. */}
			{href && (
				<Link
					href={href}
					className="focus-visible:ring-accent-foreground focus-visible:ring-offset-background absolute inset-0 z-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					<span className="sr-only">{linkLabel}</span>
				</Link>
			)}
		</article>
	);
}
