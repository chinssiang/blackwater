import { stegaClean } from '@sanity/client/stega';
import {
	type MaybeSanityColor,
	buildRgbaCssString,
	ensureAccessibleTextColor,
} from '@/lib/image-utils';

// Turns a Sanity `sectionAppearance` object into the classes, CSS custom
// properties and colours <SectionShell> renders. Pure and separate from the
// component so the branches below can be tested directly -- they are all
// content-shaped edge cases (absent object, cleared field, one colour but not
// the other) that are tedious to reach through the Studio.

export type MaxWidth = 'none' | 'xl' | 'l' | 'm' | 's' | 'xs';

// The same ceilings in pixels. A grid inside a narrowed section needs them to
// size its images: `sizes` is resolved by the browser before any layout exists,
// so a vw figure alone always describes the FULL-width case. Kept beside the
// class map for the reason stated below -- the two have to agree.
export const MAX_WIDTH_PX = {
	xl: 1280,
	l: 1024,
	m: 768,
	s: 576,
	xs: 320,
} as const satisfies Record<Exclude<MaxWidth, 'none'>, number>;

// Arbitrary values, deliberately NOT `max-w-3xl` and friends. Originally because
// globals.css rescaled Tailwind's `--container-*` namespace, which is where
// `max-w-*` reads its rungs from -- `3xl` was 1800px, `xl` 1200px -- so `m` and
// `s` rendered WIDER than `xl` and `l` and a `faqBlock` asking for a 768px
// reading measure got 1800px. That override is gone now (see the note at the top
// of globals.css), so the rungs would be honest again.
//
// They stay arbitrary anyway, for a second reason that outlives the first: these
// five widths have to equal MAX_WIDTH_PX, which sizes the images inside a
// narrowed section, and no Tailwind rung sits at all five. Naming them would
// re-couple this ladder to a scale it does not control.
//
// The type below spells each class out as a literal -- Tailwind only emits
// utilities whose names it finds as literal strings, so these cannot be
// generated -- while pinning it to its MAX_WIDTH_PX entry, so the two maps
// disagreeing, or a new rung reaching only one of them, is a COMPILE error
// rather than something a test has to notice.
export const MAX_WIDTH_CLASSES: {
	[K in keyof typeof MAX_WIDTH_PX]: `max-w-[${(typeof MAX_WIDTH_PX)[K]}px]`;
} & { none: 'w-full' } = {
	none: 'w-full',
	xl: 'max-w-[1280px]',
	l: 'max-w-[1024px]',
	m: 'max-w-[768px]',
	s: 'max-w-[576px]',
	xs: 'max-w-[320px]',
};

// An allowlist rather than a passthrough: `textAlign` arrives as a class name
// straight from a document, so anything unrecognised must fall back rather than
// reach the class attribute.
const TEXT_ALIGN_CLASSES = new Set([
	'text-left',
	'text-center',
	'text-right',
	'text-justify',
]);

const DEFAULT_ALIGN = 'text-left';

// Mirrors the `initialValue`s on section-appearance.js. Declared here as well
// because `initialValue` only fires when an editor creates a new array item in
// the Studio: every module already in a dataset, and every module written
// through the API or a migration, carries no spacing at all and would otherwise
// fall through `section-spacing`'s own `var(--section-pt, 0)` to zero padding.
// The schema and the resolver have to agree, the way maxWidth/textAlign already
// do through MAX_WIDTH_CLASSES.none and DEFAULT_ALIGN. Tailwind scale steps.
const DEFAULT_SPACING = 9;
const DEFAULT_SPACING_DESKTOP = 12;

export type SectionAppearance = {
	// MaybeSanityColor, not SanityColor: typegen projects a brand-colour deref
	// with every field optional (see its note in image-utils), so no generated
	// shape satisfies the stricter type and every page module that carries a
	// sectionAppearance fails to type-check against it. `buildRgbaCssString`
	// already takes MaybeSanityColor and narrows internally, so the looser type
	// is what the consumer here was written for.
	backgroundColor?: MaybeSanityColor;
	textColor?: MaybeSanityColor;
	textAlign?: string | null;
	maxWidth?: MaxWidth | string | null;
	spacingTop?: number | null;
	spacingBottom?: number | null;
	spacingTopDesktop?: number | null;
	spacingBottomDesktop?: number | null;
} | null;

export type ResolvedSectionAppearance = {
	alignClass: string;
	maxWidthClass: string;
	/**
	 * Whether the section spans its container rather than being capped. Two
	 * decisions read it -- which horizontal inset <SectionShell> publishes
	 * (the centring `--padding-max` or the flat gutter) and whether a wave hero may
	 * underlap the header -- and both were previously comparing the class string
	 * by hand, so a rename of the `none` class would have silently flipped one.
	 */
	isFullWidth: boolean;
	/** The section's own text colour, or a legible default over an authored background. */
	inkCss: string | undefined;
	paperCss: string | undefined;
	spacing: {
		pt: number | undefined;
		pb: number | undefined;
		ptSm: number | undefined;
		pbSm: number | undefined;
	};
};

export function resolveSectionAppearance(
	appearance?: SectionAppearance
): ResolvedSectionAppearance {
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

	// stegaClean, not a raw read: in draft mode the client encodes invisible
	// metadata into every string, so these two -- one used as a class name, one
	// as a map key -- would silently stop matching in the Presentation preview
	// while working in production. Same rule the events/products modules follow
	// by resolving their discriminators inside GROQ.
	const align = stegaClean(textAlign) ?? '';
	const width = stegaClean(maxWidth) ?? '';

	const paperCss = buildRgbaCssString(backgroundColor) || undefined;
	const authoredInk = buildRgbaCssString(textColor) || undefined;

	// A background with no text colour is the most natural single edit an editor
	// can make, and it used to leave the theme's ink on the authored surface --
	// near-white on white, since the site renders dark-only. Fall back to the
	// legible neutral for that background instead. An authored text colour is
	// always honoured as-is; this only fills the gap.
	const inkCss =
		authoredInk ??
		(backgroundColor
			? ensureAccessibleTextColor(null, backgroundColor) || undefined
			: undefined);

	// `||`, not `??`: a cleared field can arrive as '' , which `??` passes
	// through as a class name of nothing.
	const maxWidthClass =
		MAX_WIDTH_CLASSES[width as MaxWidth] || MAX_WIDTH_CLASSES.none;

	return {
		alignClass: TEXT_ALIGN_CLASSES.has(align) ? align : DEFAULT_ALIGN,
		maxWidthClass,
		isFullWidth: maxWidthClass === MAX_WIDTH_CLASSES.none,
		inkCss,
		paperCss,
		spacing: {
			pt: spacingTop ?? DEFAULT_SPACING,
			pb: spacingBottom ?? DEFAULT_SPACING,
			ptSm: spacingTopDesktop ?? DEFAULT_SPACING_DESKTOP,
			pbSm: spacingBottomDesktop ?? DEFAULT_SPACING_DESKTOP,
		},
	};
}
