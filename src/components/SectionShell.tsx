import { cn, getSpacingClass, type SpacingValue } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';
import type { SanityColor } from '@/lib/image-utils';

// The <section> wrapper every page module renders, and the one place the
// `sectionAppearance` object is turned into classes and styles.
//
// Extracted when the fourth copy of this block appeared. The copies had already
// drifted: FaqBlock maps `maxWidth` through `lg`/`md` keys the schema never
// emits (section-appearance.js offers none|xl|l|m|s|xs), so two of its options
// silently fall through to its default. This map is keyed to the schema, so that
// class of bug has one place to live rather than four.
//
// No hooks and no 'use client', so a Server Component module and the client
// Freeform can both render it.

type MaxWidth = 'none' | 'xl' | 'l' | 'm' | 's' | 'xs';

const MAX_WIDTH_CLASSES: Record<MaxWidth, string> = {
	none: 'w-full',
	xl: 'max-w-7xl',
	l: 'max-w-5xl',
	m: 'max-w-3xl',
	s: 'max-w-xl',
	xs: 'max-w-xs',
};

export type SectionAppearance = {
	backgroundColor?: SanityColor | null;
	textColor?: SanityColor | null;
	textAlign?: string | null;
	maxWidth?: MaxWidth | null;
	spacingTop?: SpacingValue | null;
	spacingBottom?: SpacingValue | null;
	spacingTopDesktop?: SpacingValue | null;
	spacingBottomDesktop?: SpacingValue | null;
} | null;

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
	const {
		backgroundColor,
		textColor,
		textAlign,
		maxWidth,
		spacingTop,
		spacingBottom,
		spacingTopDesktop,
		spacingBottomDesktop,
	} = appearance || {};

	// Padding rather than margin once a background is set, so the colour extends
	// through the gap instead of leaving a band of page behind it.
	const hasBackground = !!backgroundColor;

	return (
		<section
			className={cn(
				'px-contain mx-auto',
				textAlign ?? 'text-left',
				(maxWidth && MAX_WIDTH_CLASSES[maxWidth]) ?? MAX_WIDTH_CLASSES.none,
				getSpacingClass('marginTop', spacingTop, hasBackground),
				getSpacingClass('marginBottom', spacingBottom, hasBackground),
				getSpacingClass('marginTopDesktop', spacingTopDesktop, hasBackground),
				getSpacingClass(
					'marginBottomDesktop',
					spacingBottomDesktop,
					hasBackground
				),
				className
			)}
			style={{
				color: buildRgbaCssString(textColor) || 'inherit',
				backgroundColor: buildRgbaCssString(backgroundColor) || undefined,
			}}
		>
			{heading && <h2 className="t-h-3 mb-6 uppercase">{heading}</h2>}
			{children}
		</section>
	);
}
