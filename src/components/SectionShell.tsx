import type { CSSProperties } from 'react';
import { cn, SECTION_INSET } from '@/lib/utils';
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
	headingAction,
	headingLevel = 'h2',
	className,
	children,
	bleed = false,
}: {
	appearance?: SectionAppearance;
	heading?: string;
	/**
	 * Optional trailing element on the heading's baseline -- a "see all" link and
	 * the like. Rendered only when passed; a module that omits it gets exactly
	 * the markup it had before this existed.
	 */
	headingAction?: React.ReactNode;
	/**
	 * The tag for `heading`. Threaded from PageHome via PageModules so the module
	 * in slot 0 owns the page's <h1> whatever its type is -- previously only
	 * heroBlock read the level, so hiding a hero (or authoring any other type
	 * first) left the homepage with no <h1> at all.
	 */
	headingLevel?: 'h1' | 'h2';
	className?: string;
	children: React.ReactNode;
	bleed?: boolean;
}) {
	const { alignClass, maxWidthClass, inkCss, paperCss, spacing } =
		resolveSectionAppearance(appearance);
	const Heading = headingLevel;

	return (
		<section
			className={cn(
				'section-spacing mx-auto',
				!bleed && SECTION_INSET,
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
			{/* `t-h-2`, not `t-h-3`: `t-h-3` is the card-title token, so a section
			    heading rendered in it was the exact size of the cards it governed and
			    the section read as one flat band. Both scales resolve to --t-size-h2
			    now; the ladder and its ratios live in globals.css. */}
			{(heading || headingAction) && (
				// The flex classes are CONDITIONAL on `headingAction`, not always on.
				// `sectionAppearance` can set text-center/text-right (alignClass, on
				// the section), and a heading that is always a flex item shrinks to
				// its own text -- text-align then has nothing left to move, so every
				// centred section would silently go left. With no action the h2 stays
				// a block and alignment behaves as it always has.
				//
				// `mb-6` and the bleed inset live on the wrapper rather than the h2 so
				// the action shares them instead of escaping the row.
				<div
					className={cn(
						'mb-6',
						headingAction && 'flex items-baseline justify-between gap-4',
						bleed && SECTION_INSET
					)}
				>
					{/* Gated separately from the wrapper: `heading` is optional on every
					    module that has one, and an action must not vanish with it. */}
					{heading && <Heading className="t-h-2 uppercase">{heading}</Heading>}
					{headingAction}
				</div>
			)}
			{children}
		</section>
	);
}
