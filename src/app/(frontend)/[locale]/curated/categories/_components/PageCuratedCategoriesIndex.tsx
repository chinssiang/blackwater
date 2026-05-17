'use client';

import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';
import CuratedCategoriesGrid from '../../_components/CuratedCategoriesGrid';
import type { PageCuratedCategoriesIndexQueryResult } from 'sanity.types';

type Props = {
	data: NonNullable<PageCuratedCategoriesIndexQueryResult>;
};

export function PageCuratedCategoriesIndex({ data }: Props) {
	const { categories } = data || {};

	return (
		<div className="theme-light bg-background text-foreground px-contain mx-auto min-h-[inherit] py-10 lg:py-17.5">
			<motion.div
				className="mb-10 lg:mb-17.5"
				initial="hide"
				animate="show"
				variants={fadeAnim}
				transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
			>
				<h1 className="t-h-2 uppercase">Categories</h1>
			</motion.div>

			<CuratedCategoriesGrid categories={categories ?? null} priority />
		</div>
	);
}
