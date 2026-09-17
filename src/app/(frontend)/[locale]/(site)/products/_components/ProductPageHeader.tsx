'use client';

import { type CSSProperties, Fragment } from 'react';
import Link from 'next/link';
import { interpolate, pickPlural } from '@/lib/dictionary';

type CountForms = { one: string; other: string };

type Props = {
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

export default function ProductPageHeader({ title, counts, lede }: Props) {
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
		<header
			className="m-x-max reveal mb-12 lg:mb-20"
			style={{ '--reveal-duration': '0.8s' } as CSSProperties}
		>
			<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
				{title && (
					<h1 className="t-h-1 max-w-[18ch] text-balance uppercase">{title}</h1>
				)}
				{segments.length > 0 && (
					<p className="t-spec text-foreground/65 whitespace-nowrap">
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
										className="hover:text-accent-foreground transition-colors pointer-coarse:min-h-11"
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
				<p className="t-b-1 text-foreground/70 mt-6 max-w-[62ch]">{lede}</p>
			)}
		</header>
	);
}
