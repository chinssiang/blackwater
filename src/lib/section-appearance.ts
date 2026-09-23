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
export const MAX_WIDTH_PX: Record<Exclude<MaxWidth, 'none'>, number> = {
	xl: 1280,
	l: 1024,
	m: 768,
	s: 576,
	xs: 320,
};

// Tailwind's own rungs, and each one lands exactly on its MAX_WIDTH_PX entry
// above: `7xl` is 80rem, `5xl` 64rem, `3xl` 48rem, `xl` 36rem, `xs` 20rem --
// 1280/1024/768/576/320px at a 16px root.
//
// That agreement is only true because globals.css leaves the `--container-*`
// scale at STOCK. It used to rescale it, which is where `max-w-*` reads its
// rungs from, so `3xl` meant 1800px and `xl` 1200px -- `m` and `s` rendered
// WIDER than `xl` and `l`, and a `faqBlock` asking for a 768px reading measure
// got 1800px. Do not reintroduce that override (the note at the top of
// globals.css says why); these five names are the whole reason it must not
// come back.
//
// The two maps are kept in step BY HAND. There is no type that ties `max-w-3xl`
// to 768, so adding a rung means editing both -- `section-appearance.test.ts`
// pins each class and asserts the ladder ascends, which is what caught the
// inversion above.
//
// One consequence of naming them: the rungs are rem-based, so at a root font
// other than 16px the rendered cap scales while MAX_WIDTH_PX does not. That
// skews `ProductsBlock`'s image `sizes` hint slightly, never the layout.
const MAX_WIDTH_CLASSES: Record<MaxWidth, string> = {
	none: 'w-full',
	xl: 'max-w-7xl',
	l: 'max-w-5xl',
	m: 'max-w-3xl',
	s: 'max-w-xl',
	xs: 'max-w-xs',
};

// An allowlist rather than a passthrough: `textAlign` arrives as a class name
// straight from a document, so anything unrecognised must fall back rather than
// reach the class attribute.
// Exported as a tuple, and `alignClass` is narrowed to it below, so a consumer
// mapping these to something else (HeroBlock turns them into an auto margin)
// gets a COMPILE error when a fifth alignment is added rather than a silent
// fallback. Same reason MAX_WIDTH_CLASSES and MAX_WIDTH_PX are pinned by a test:
// two hand-kept maps of the same vocabulary are how this drifts.
export const TEXT_ALIGN_CLASSES = [
	'text-left',
	'text-center',
	'text-right',
	'text-justify',
] as const;

export type TextAlignClass = (typeof TEXT_ALIGN_CLASSES)[number];

// A Set for the lookup, because `align` arrives as an unnarrowed string.
const TEXT_ALIGN_CLASS_SET: ReadonlySet<string> = new Set(TEXT_ALIGN_CLASSES);

const DEFAULT_ALIGN: TextAlignClass = 'text-left';

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
	alignClass: TextAlignClass;
	maxWidthClass: string;
	/**
	 * Whether the section spans its container rather than being capped. It is
	 * what <SectionShell> reads to pick the inset it publishes as
	 * `--section-inset` -- the centring `--padding-max` or the flat gutter --
	 * and it was previously comparing the class string by hand, so a rename of
	 * the `none` class would have silently flipped it.
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
		alignClass: TEXT_ALIGN_CLASS_SET.has(align)
			? (align as TextAlignClass)
			: DEFAULT_ALIGN,
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
