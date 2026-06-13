'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { pickPlural, interpolate } from '@/lib/dictionary';

type Category = {
	_id: string;
	title?: string | null;
	slug?: string | null;
	coverImage?: any;
	count?: number | null;
};

type ProductCategoriesGridProps = {
	categories: Category[] | null;
	showViewAll?: boolean;
	priority?: boolean;
	heading?: string | null;
};

function countLabel(
	forms: { one: string; other: string },
	count?: number | null
) {
	if (count == null) return null;
	return interpolate(pickPlural(forms, count), { count });
}

function CategoryTile({
	category,
	priority = false,
}: {
	category: Category;
	priority?: boolean;
}) {
	const locale = useLocale();
	const t = useTranslations('products');
	const label = countLabel(t.productCount, category.count);
	const hasImage = !!category.coverImage?.image;

	return (
		<Link
			href={
				resolveHref({
					documentType: 'pProductCategory',
					slug: category.slug,
					locale,
				})!
			}
			className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		>
			{hasImage && (
				<div className="relative mb-3 aspect-[4/5] overflow-hidden bg-foreground/6">
					<ImageBlock
						className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
						imageObj={category.coverImage}
						alt={category.title ?? ''}
						sizes="(max-width: 768px) 50vw, 30vw"
						priority={priority}
					/>
				</div>
			)}
			<div className="flex items-baseline justify-between gap-3 border-t border-foreground/15 pt-3">
				<span className="t-h-3 uppercase transition-opacity duration-200 group-hover:opacity-60">
					{category.title}
				</span>
				{label && (
					<span className="t-l-2 whitespace-nowrap uppercase text-foreground/65">
						{label}
					</span>
				)}
			</div>
		</Link>
	);
}

export default function ProductCategoriesGrid({
	categories,
	showViewAll = false,
	priority = false,
	heading,
}: ProductCategoriesGridProps) {
	const reveal = useReveal();
	const locale = useLocale();
	const t = useTranslations('products');

	if (!categories || categories.length === 0) return null;

	// `undefined` (prop omitted) falls back to the localized label; `null` hides it.
	const resolvedHeading = heading === undefined ? t.categoriesTitle : heading;
	const showHeader = resolvedHeading != null || showViewAll;

	return (
		<motion.section
			{...reveal}
			transition={{ duration: 0.8, ease: [0, 0.5, 0.5, 1] }}
		>
			{showHeader && (
				<div className="mb-6 flex items-baseline justify-between gap-4 lg:mb-8">
					{resolvedHeading != null ? (
						<h2 className="t-l-2 uppercase text-foreground/70">
							{resolvedHeading}
						</h2>
					) : (
						<span />
					)}
					{showViewAll && (
						<Link
							href={
								resolveHref({
									documentType: 'pProductCategoriesIndex',
									locale,
								})!
							}
							className="t-l-2 inline-flex items-center uppercase text-foreground/70 transition-colors hover:text-accent-foreground pointer-coarse:min-h-11"
						>
							{t.allCategories}
						</Link>
					)}
				</div>
			)}

			<div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:gap-x-10 2xl:grid-cols-4">
				{categories.map((cat, index) => (
					<CategoryTile
						key={cat._id}
						category={cat}
						priority={priority && index === 0}
					/>
				))}
			</div>
		</motion.section>
	);
}
