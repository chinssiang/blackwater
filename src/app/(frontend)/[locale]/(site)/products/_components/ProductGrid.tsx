'use client';

import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import ProductCard from './ProductCard';

export type ProductCardData = ComponentProps<typeof ProductCard>['product'];

type Props = {
	products: ProductCardData[];
	className?: string;
	/** Offset added to each card's reveal index (for stagger after other rows). */
	indexOffset?: number;
};

/**
 * The shared responsive product grid. Single source of truth for the listing
 * columns/gaps used on the index showcase, collection rows, and the all-products
 * and filtered listings.
 */
export default function ProductGrid({
	products,
	className,
	indexOffset = 0,
}: Props) {
	return (
		<div
			className={cn(
				'grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10',
				className
			)}
		>
			{products.map((product, index) => (
				<ProductCard
					key={product._id}
					product={product}
					index={indexOffset + index}
				/>
			))}
		</div>
	);
}
