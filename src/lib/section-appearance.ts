import { stegaClean } from '@sanity/client/stega';
import {
	buildRgbaCssString,
	ensureAccessibleTextColor,
	type SanityColor,
} from '@/lib/image-utils';

// Turns a Sanity `sectionAppearance` object into the classes, CSS custom
// properties and colours <SectionShell> renders. Pure and separate from the
// component so the branches below can be tested directly -- they are all
// content-shaped edge cases (absent object, cleared field, one colour but not
// the other) that are tedious to reach through the Studio.

export type MaxWidth = 'none' | 'xl' | 'l' | 'm' | 's' | 'xs';

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
const TEXT_ALIGN_CLASSES = new Set([
	'text-left',
	'text-center',
	'text-right',
	'text-justify',
]);

const DEFAULT_ALIGN = 'text-left';

export type SectionAppearance = {
	backgroundColor?: SanityColor | null;
	textColor?: SanityColor | null;
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

	return {
		alignClass: TEXT_ALIGN_CLASSES.has(align) ? align : DEFAULT_ALIGN,
		// `||`, not `??`: a cleared field can arrive as '' , which `??` passes
		// through as a class name of nothing.
		maxWidthClass:
			MAX_WIDTH_CLASSES[width as MaxWidth] || MAX_WIDTH_CLASSES.none,
		inkCss,
		paperCss,
		spacing: {
			pt: spacingTop ?? undefined,
			pb: spacingBottom ?? undefined,
			ptSm: spacingTopDesktop ?? undefined,
			pbSm: spacingBottomDesktop ?? undefined,
		},
	};
}
