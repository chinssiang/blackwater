import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import {
	resolveSectionAppearance,
	type SectionAppearance,
} from '@/lib/section-appearance';

// The <section> wrapper every page module renders, and the one place the
// `sectionAppearance` object reaches the DOM.
//
// Extracted when the fourth copy of this block appeared. The copies had already
// drifted: FaqBlock mapped `maxWidth` through `lg`/`md` keys the schema never
// emits (section-appearance.js offers none|xl|l|m|s|xs), so two of its options
// silently fell through to its default. The mapping itself now lives in
// src/lib/section-appearance.ts, keyed to the schema and unit-tested, so that
// class of bug has one place to live rather than four.
//
// No hooks and no 'use client', so a Server Component module and the client
// Freeform can both render it.

export type { SectionAppearance };

export default function SectionShell({
	appearance,
	heading,
	className,
	children,
}: {
	appearance?: SectionAppearance;
	heading?: string;
	className?: string;
	children: React.ReactNode;
}) {
	const { alignClass, maxWidthClass, inkCss, paperCss, spacing } =
		resolveSectionAppearance(appearance);

	return (
		<section
			className={cn(
				'section-spacing px-contain mx-auto',
				// The token remapping lives in globals.css beside .cart-surface, which
				// solves the same problem for the cart's light surface. Each class is
				// added only when that colour is in play, so an uncoloured section
				// resolves exactly as it did before.
				inkCss && 'section-ink',
				paperCss && 'section-paper',
				alignClass,
				maxWidthClass,
				className
			)}
			style={
				{
					// Raw scale steps, not lengths: `section-spacing` multiplies them by
					// the theme's own `--spacing`. React passes numbers through unsuffixed
					// for custom properties, and drops undefined.
					'--section-pt': spacing.pt,
					'--section-pb': spacing.pb,
					'--section-pt-sm': spacing.ptSm,
					'--section-pb-sm': spacing.pbSm,
					'--section-fg': inkCss,
					'--section-bg': paperCss,
					// The paint itself. The classes above only redefine tokens for
					// descendants; this section still has to draw its own colours.
					color: inkCss,
					backgroundColor: paperCss,
				} as CSSProperties
			}
		>
			{heading && <h2 className="t-h-3 mb-6 uppercase">{heading}</h2>}
			{children}
		</section>
	);
}
