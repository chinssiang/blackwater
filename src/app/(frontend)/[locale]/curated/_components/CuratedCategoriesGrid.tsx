import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';

type Category = {
	_id: string;
	title?: string | null;
	slug?: string | null;
	coverImage?: any;
	count?: number | null;
};

type CuratedCategoriesGridProps = {
	categories: Category[] | null;
	showViewAll?: boolean;
	priority?: boolean;
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
			href={`/curated/categories/${category.slug}`}
			className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		>
			{hasImage && (
				<div className="relative mb-3 aspect-[4/5] overflow-hidden bg-foreground/10">
					<ImageBlock
						className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
						imageObj={category.coverImage}
						alt={category.title ?? ''}
						sizes="(max-width: 768px) 50vw, 30vw"
						priority={priority}
					/>
				</div>
			)}
			<div className="flex items-baseline justify-between gap-3 border-t border-foreground/15 pt-3">
				<span className="t-h-3 uppercase transition-opacity duration-200 group-hover:opacity-55">
					{category.title}
				</span>
				{label && (
					<span className="t-l-2 uppercase whitespace-nowrap text-foreground/65">
						{label}
					</span>
				)}
			</div>
		</Link>
	);
}

export default function CuratedCategoriesGrid({
	categories,
	showViewAll = false,
	priority = false,
}: CuratedCategoriesGridProps) {
	if (!categories || categories.length === 0) return null;

	return (
		<motion.section
			initial="hide"
			animate="show"
			variants={fadeAnim}
			transition={{ duration: 0.8, ease: [0, 0.5, 0.5, 1] }}
		>
			<div className="mb-6 flex items-baseline justify-between gap-4 lg:mb-8">
				<h2 className="t-l-2 uppercase text-foreground/70">Categories</h2>
				{showViewAll && (
					<Link
						href="/curated/categories"
						className="t-l-2 uppercase text-foreground/75 transition-colors hover:text-foreground"
					>
						All categories →
					</Link>
				)}
			</div>

			<div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:gap-x-10">
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
