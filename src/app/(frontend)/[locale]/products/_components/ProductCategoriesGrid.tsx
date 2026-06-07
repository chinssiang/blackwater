'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';

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
	/** Section label. Pass null to hide it (e.g. on the categories index,
	   where the page masthead already carries the title). */
	heading?: string | null;
};

function countLabel(count?: number | null) {
	if (count == null) return null;
	return `${count} ${count === 1 ? 'product' : 'products'}`;
}

function CategoryTile({
	category,
	priority = false,
}: {
	category: Category;
	priority?: boolean;
}) {
	const label = countLabel(category.count);
	const hasImage = !!category.coverImage?.image;

	return (
		<Link
			href={`/products/categories/${category.slug}`}
			className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark-ink focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		>
			{hasImage && (
				<div className="relative mb-3 aspect-[4/5] overflow-hidden bg-foreground/[0.06]">
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
	heading = 'Categories',
}: ProductCategoriesGridProps) {
	const reveal = useReveal();

	if (!categories || categories.length === 0) return null;

	const showHeader = heading != null || showViewAll;

	return (
		<motion.section
			{...reveal}
			transition={{ duration: 0.8, ease: [0, 0.5, 0.5, 1] }}
		>
			{showHeader && (
				<div className="mb-6 flex items-baseline justify-between gap-4 lg:mb-8">
					{heading != null ? (
						<h2 className="t-l-2 uppercase text-foreground/70">{heading}</h2>
					) : (
						<span />
					)}
					{showViewAll && (
						<Link
							href="/products/categories"
							className="t-l-2 inline-flex items-center uppercase text-foreground/70 transition-colors hover:text-mark-ink pointer-coarse:min-h-11"
						>
							All categories →
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
