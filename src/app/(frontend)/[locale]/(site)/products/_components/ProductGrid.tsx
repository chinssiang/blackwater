'use client';

import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import ProductCard from '@/components/ProductCard';

export type ProductCardData = ComponentProps<typeof ProductCard>['product'];

type Props = {
	products: ProductCardData[];
	className?: string;
	/** Offset added to each card's reveal index (for stagger after other rows). */
	indexOffset?: number;
};

/**
 * The shared responsive product grid. Columns and gaps match the plain
 * (unfiltered) listing grid in PageProductsAll exactly, so switching a filter
 * on never reflows the page.
 */
export default function ProductGrid({
	products,
	className,
	indexOffset = 0,
}: Props) {
	return (
		<div
			className={cn(
				'grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-3 lg:gap-y-16 2xl:grid-cols-4 2xl:gap-x-10',
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
