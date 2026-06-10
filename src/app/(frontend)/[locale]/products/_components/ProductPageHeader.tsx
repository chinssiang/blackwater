'use client';

import { motion } from 'motion/react';
import { useReveal } from '@/hooks/useReveal';
import { pickPlural, interpolate } from '@/lib/dictionary';

type CountForms = { one: string; other: string };

type Props = {
	/** Wayfinding label shown only where it carries real context (single pages). */
	kicker?: string | null;
	title?: string | null;
	/** Count segments shown in the header, e.g.
	   [{count: 48, forms: t.productCount}]. `forms` is a localized {one, other}
	   template (with a {count} placeholder) — callers pass the dictionary entry
	   for the unit. null/undefined counts are skipped. */
	counts?: Array<{ count: number | null | undefined; forms: CountForms }>;
	lede?: string | null;
};

export default function ProductPageHeader({
	kicker,
	title,
	counts,
	lede,
}: Props) {
	const reveal = useReveal();

	const segments = (counts ?? [])
		.filter((c): c is { count: number; forms: CountForms } => c.count != null)
		.map(({ count, forms }) => interpolate(pickPlural(forms, count), { count }));

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
				{segments.length > 0 && (
					<p className="t-spec whitespace-nowrap text-foreground/65">
						{segments.join(' | ')}
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
