import Link from 'next/link';
import Img from '@/components/Image';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';

type CuratedProductCardProps = {
	product: {
		_id: string;
		slug?: string | null;
		title?: string | null;
		badge?: string | null;
		excerpt?: string | null;
		price?: string | null;
		categories?: Array<{ _id: string; title?: string | null }> | null;
		brands?: Array<{ _id: string; title?: string | null }> | null;
		mainImage?: any;
	};
	index?: number;
};

export default function CuratedProductCard({
	product,
	index = 0,
}: CuratedProductCardProps) {
	const categoryLabel = product.categories
		?.map((c) => c.title)
		.filter(Boolean)
		.join(', ');
	const brandLabel = product.brands
		?.map((b) => b.title)
		.filter(Boolean)
		.join(', ');

	return (
		<motion.article
			initial="hide"
			animate="show"
			variants={fadeAnim}
			transition={{
				duration: 0.8,
				delay: index * 0.06,
				ease: [0, 0.5, 0.5, 1],
			}}
		>
			<Link
				href={`/curated/${product.slug}`}
				className="group flex flex-col h-full"
			>
				{/* Badge */}
				{product.badge && (
					<p className="t-h-6 uppercase text-muted mb-2">{product.badge}</p>
				)}

				{/* Image */}
				<div className="relative aspect-square overflow-hidden bg-foreground/5 mb-0">
					{product.mainImage ? (
						<Img
							className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
							imageObj={product.mainImage}
							alt={product.title ?? ''}
						/>
					) : (
						<div className="w-full h-full bg-foreground/5" />
					)}
				</div>

				{/* Details button */}
				<div className="bg-foreground/40 text-background py-2.5 text-center t-h-6 uppercase group-hover:bg-foreground/60 transition-colors">
					Details
				</div>

				{/* Info */}
				<div className="flex flex-col gap-1 mt-3">
					{/* Category → Brand */}
					{(categoryLabel || brandLabel) && (
						<p className="t-h-6 uppercase">
							{[brandLabel, categoryLabel].filter(Boolean).join(' → ')}
						</p>
					)}

					{/* Excerpt */}
					{product.excerpt && (
						<p className="t-b-2 text-muted line-clamp-2">{product.excerpt}</p>
					)}

					{/* Price */}
					{product.price && (
						<p className="t-b-2 text-muted">{product.price}</p>
					)}
				</div>
			</Link>
		</motion.article>
	);
}
