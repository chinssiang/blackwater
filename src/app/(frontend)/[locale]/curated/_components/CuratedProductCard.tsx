import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';
import { Button } from '@/components/ui/Button';

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
		<motion.div
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
				href={`/curated/products/${product.slug}`}
				className="group flex flex-col h-full"
			>
				{/* Badge */}
				{product.badge && (
					<p className="t-h-6 uppercase text-muted mb-2">{product.badge}</p>
				)}

				{/* Image */}
				<div className="relative aspect-square overflow-hidden bg-foreground/5 mb-0">
					{product.mainImage ? (
						<ImageBlock
							className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
							imageObj={product.mainImage}
							alt={product.title ?? ''}
						/>
					) : (
						<div className="w-full h-full bg-foreground/5" />
					)}
				</div>

				{/* Details button */}
				<Button asChild size="xl" className="uppercase">
					<div>Details</div>
				</Button>

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
					{product.price && <p className="t-b-2 text-muted">{product.price}</p>}
				</div>
			</Link>
		</motion.div>
	);
}
