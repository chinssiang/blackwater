'use client';

import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';

type Props = {
	/** Wayfinding label shown only where it carries real context (single pages). */
	kicker?: string | null;
	title?: string | null;
	count?: number | null;
	/** Singular unit for the count, e.g. "product" / "category". Pluralized
	   automatically against the count. */
	unit?: string;
	lede?: string | null;
};

function pluralize(count: number, unit: string) {
	if (count === 1) return unit;
	return unit.endsWith('y') ? `${unit.slice(0, -1)}ies` : `${unit}s`;
}

export default function CuratedPageHeader({
	kicker,
	title,
	count,
	unit,
	lede,
}: Props) {
	const reveal = useReveal();

	return (
		<motion.header
			className="mb-12 lg:mb-20"
			{...reveal}
			transition={{ duration: 0.8, ease: [0, 0.71, 0.2, 1.01] }}
		>
			{kicker && (
				<p className="t-l-2 mb-4 uppercase text-foreground/65">{kicker}</p>
			)}

			<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
				{title && (
					<h1 className="max-w-[18ch] text-balance text-[clamp(2rem,6vw,3.75rem)] uppercase leading-[0.95] tracking-[-0.02em]">
						{title}
					</h1>
				)}
				{count != null && unit && (
					<p className="t-spec pb-1 whitespace-nowrap text-foreground/65">
						{count} {pluralize(count, unit)}
					</p>
				)}
			</div>

			{lede && (
				<p className="t-b-1 mt-6 max-w-[62ch] leading-relaxed text-foreground/70">
					{lede}
				</p>
			)}
		</motion.header>
	);
}
