import { imageBuilder } from '@/sanity/lib/image';

interface BuildImageOptions {
	width?: number;
	height?: number;
	format?: 'jpg' | 'pjpg' | 'png' | 'webp';
	quality?: number;
}

interface SanityRgb {
	r: number;
	g: number;
	b: number;
	a: number;
}

export interface SanityColor {
	hex: string;
	rgb: SanityRgb;
}

/**
 * What a projected brand-colour deref actually arrives as.
 *
 * Typegen widens `statusTextColor->{...color}` to `{} | Color | null` — a union
 * it cannot narrow, whose Color arm has every field optional — so no generated
 * shape satisfies `SanityColor`. Accepting this at the boundary and narrowing
 * once here keeps the cast out of every renderer; `EventTicket` used to carry
 * its own copy, and `image-utils.test.ts` had to hand-roll the same thing.
 *
 * Structural rather than `unknown`: both generated arms are assignable (every
 * field is optional, and excess properties are allowed from a non-fresh
 * object), while a primitive or an unrelated value is still a type error. An
 * `unknown` parameter let `buildRgbaCssString(eventStatus)` compile and paint
 * white instead of failing the build.
 */
export type MaybeSanityColor =
	| { hex?: string | null; rgb?: Partial<SanityRgb> | null }
	| null
	| undefined;

/**
 * Narrows a projected colour to the shape the maths needs.
 *
 * Returns null unless the value carries all three colour channels as numbers.
 * That is stricter than it looks and deliberately so: with only `!color` and
 * `?? 255` defaults, a colour document whose `rgb` was empty rendered as
 * opaque white, and ensureAccessibleTextColor then measured NaN against it and
 * answered with the near-white neutral — white ink on a white pill, the exact
 * failure this module exists to prevent. A colour with no usable channels is
 * "no colour", so both helpers fall back to their caller's theme tokens.
 */
export function asSanityColor(value: MaybeSanityColor): SanityColor | null {
	if (!value || typeof value !== 'object') return null;
	const { rgb } = value as { rgb?: Partial<SanityRgb> | null };
	if (
		typeof rgb?.r !== 'number' ||
		typeof rgb?.g !== 'number' ||
		typeof rgb?.b !== 'number'
	) {
		return null;
	}
	return value as SanityColor;
}

export function buildImageSrc(
	image: any,
	{ width, height, format, quality = 80 }: BuildImageOptions = {}
): string {
	if (!image || !imageBuilder) {
		return '';
	}

	try {
		let imgSrc = imageBuilder.image(image);

		if (width) {
			imgSrc = imgSrc.width(Math.round(width));
		}

		if (height) {
			imgSrc = imgSrc.height(Math.round(height));
		}

		if (format) {
			imgSrc = imgSrc.format(format);
		}

		if (quality) {
			imgSrc = imgSrc.quality(quality);
		}

		return imgSrc?.fit('max').auto('format').url() || '';
	} catch (error) {
		console.error('Error building image source:', error);
		return '';
	}
}

export function buildRgbaCssString(
	color: MaybeSanityColor
): string | false {
	const resolved = asSanityColor(color);
	if (!resolved) {
		return false;
	}

	const { r, g, b } = resolved.rgb;
	const a = resolved.rgb.a ?? 1;

	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// WCAG relative luminance of an sRGB color (0 = black, 1 = white).
function relativeLuminance({ r, g, b }: SanityRgb): number {
	const channel = (v: number) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(lumA: number, lumB: number): number {
	const lighter = Math.max(lumA, lumB);
	const darker = Math.min(lumA, lumB);
	return (lighter + 0.05) / (darker + 0.05);
}

// Author-chosen status colors carry no contrast guarantee. Keep the author's
// text color when it clears WCAG AA (4.5:1) against their background; otherwise
// fall back to a legible neutral so the label stays readable. Returns false
// whenever the background is not measurable, which is the caller's signal to
// use a theme token pair instead (see the comment inside).
const LEGIBLE_DARK = 'rgb(23, 23, 23)';
const LEGIBLE_LIGHT = 'rgb(245, 245, 245)';

export function ensureAccessibleTextColor(
	textColorInput: MaybeSanityColor | null | undefined,
	bgColorInput: MaybeSanityColor | null | undefined
): string | false {
	const textColor = asSanityColor(textColorInput);
	const bgColor = asSanityColor(bgColorInput);
	if (!bgColor?.rgb) {
		// No AUTHORED background -- but the caller still paints one, and that is
		// why the author's ink is rejected here rather than passed through.
		//
		// The status pill — the only caller that passes an authored ink here —
		// pairs this with `buildRgbaCssString(bg) || 'var(--muted)'`, so the
		// surface in this branch is the theme's --muted. That value cannot be
		// measured from here: it is resolved in the browser, it differs per theme
		// (measured rgb(80, 80, 80) dark, rgb(245, 245, 245) light), and
		// .section-paper overrides it again to a share of the section's own ink.
		// (section-appearance.ts always passes textColor: null, so it takes this
		// branch only when it has no colours at all, and maps false to undefined.)
		// This code runs on the server during prerender and cannot know which of
		// those applies, so an authored ink in this branch is unverifiable --
		// #eeeeee, the one status document that does it, is 6.95:1 on the dark
		// --muted and 1.06:1 on the light one.
		//
		// Returning false hands the decision to the caller's `|| 'var(--foreground)'`,
		// a token pair the theme controls on both sides: measured 7.73:1 (dark)
		// and 18.16:1 (light) against --muted. The cost is that a text colour
		// authored without a background is dropped rather than rendered at a
		// contrast nobody checked.
		return false;
	}

	const bgLum = relativeLuminance(bgColor.rgb);

	if (textColor?.rgb) {
		const textLum = relativeLuminance(textColor.rgb);
		if (contrastRatio(bgLum, textLum) >= 4.5) {
			return buildRgbaCssString(textColor);
		}
	}

	const darkLum = relativeLuminance({ r: 23, g: 23, b: 23, a: 1 });
	const lightLum = relativeLuminance({ r: 245, g: 245, b: 245, a: 1 });
	return contrastRatio(bgLum, darkLum) >= contrastRatio(bgLum, lightLum)
		? LEGIBLE_DARK
		: LEGIBLE_LIGHT;
}
