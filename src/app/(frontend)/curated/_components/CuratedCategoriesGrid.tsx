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
			<h2 className="t-h-5 uppercase mb-6">Categories</h2>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{categories.map((cat, index) => (
					<div
						key={cat._id}
						className="relative aspect-[4/3] overflow-hidden bg-foreground/5"
					>
						{cat.coverImage && (
							<ImageBlock
								className="w-full h-full object-cover"
								imageObj={cat.coverImage}
								alt={cat.title ?? ''}
								priority={priority && index === 0}
							/>
						)}
						{/* Dark overlay */}
						<div className="absolute inset-0 bg-black/30" />
						{/* Title + count */}
						<div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between">
							<span className="t-h-6 uppercase text-white">
								{cat.title}
							</span>
							{cat.count != null && (
								<span className="t-h-6 text-white/70">{cat.count}</span>
							)}
						</div>
					</div>
				))}
			</div>

			{showViewAll && (
				<div className="flex justify-center mt-8">
					<Link
						href="/curated"
						className="inline-flex items-center justify-center bg-foreground text-background t-h-6 uppercase px-12 py-3 hover:bg-foreground/80 transition-colors"
					>
						View All
					</Link>
				</div>
			)}
		</motion.section>
	);
}
