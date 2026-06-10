'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { Badge } from '@/components/ui/Badge';

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
							className="relative z-10 underline-offset-4 duration-200 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
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

export default function ProductCard({ product, index = 0 }: ProductCardProps) {
	const reveal = useReveal();
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
		<motion.article
			{...reveal}
			transition={{
				duration: 0.8,
				delay: index * 0.06,
				ease: [0, 0.5, 0.5, 1],
			}}
			className="group relative flex h-full flex-col"
		>
			<div className="relative aspect-square overflow-hidden bg-background rounded">
				{product.mainImage ? (
					<ImageBlock
						className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:-translate-y-2 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
						imageObj={product.mainImage}
						alt={product.title ?? ''}
					/>
				) : (
					<div className="h-full w-full" />
				)}

				{product.badge && product.badge.length > 0 && (
					<div className="absolute top-4 left-0 flex flex-col items-start gap-1.5">
						{product.badge.map((b) => (
							<Badge key={b}>
								{(t.badges as Record<string, string>)[b] ?? b}
							</Badge>
						))}
					</div>
				)}
			</div>

			{/* Info */}
			<div className="mt-4 flex-1 space-y-3">
				<div className="flex gap-2 justify-between items-center">
					{brandLabel ? (
						<p className="t-l-1 flex-1 text-foreground">{brandLabel}</p>
					) : (
						hasCategories && (
							<CategoryLinks
								categories={categories}
								className="t-spec flex-1 uppercase text-foreground"
							/>
						)
					)}
					{showCategoryTag && (
						<CategoryLinks
							categories={categories}
							className="t-spec uppercase text-foreground/50"
						/>
					)}
				</div>
				{product.title && (
					<h3 className="t-h-3 line-clamp-2 text-balance uppercase">
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
							→
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
		</motion.article>
	);
}
