'use client';

import { Fragment } from 'react';
import Link from 'next/link';
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
	   for the unit. null/undefined counts are skipped. Pass `href` to render the
	   segment as a link (e.g. the product count linking to the all-products page). */
	counts?: Array<{
		count: number | null | undefined;
		forms: CountForms;
		href?: string | null;
	}>;
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
		.filter(
			(c): c is { count: number; forms: CountForms; href?: string | null } =>
				c.count != null
		)
		.map(({ count, forms, href }) => ({
			label: interpolate(pickPlural(forms, count), { count }),
			href: href ?? null,
		}));

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
						{segments.map((seg, i) => (
							<Fragment key={i}>
								{i > 0 && (
									<span aria-hidden className="text-foreground/30">
										{' | '}
									</span>
								)}
								{seg.href ? (
									<Link
										href={seg.href}
										className="transition-colors hover:text-accent-foreground pointer-coarse:min-h-11"
									>
										{seg.label}
									</Link>
								) : (
									seg.label
								)}
							</Fragment>
						))}
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
