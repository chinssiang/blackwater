import { urlForImage } from '@/sanity/lib/image';
import type { SanityImageSource } from '@sanity/image-url';

/**
 * The quality every Sanity image is requested at.
 *
 * 82 was tried first, on the assumption that headroom above 75 would matter for
 * photographic content. Measured against the source PNGs it does not: at w=1080,
 * two prod product shots scored 42.42 dB at 23.1KB and 43.82 dB at 13.0KB on q75,
 * against 42.85 dB at 28.4KB and 43.92 dB at 16.9KB on q82 -- 23-30% more bytes
 * for 0.1-0.4 dB, which is under the threshold anyone can see. Across 25 real card
 * images at their 640w candidate it was 285.1KB against 304.3KB.
 *
 * The ~7 dB this pipeline actually won came from deleting the second encode and
 * the `fm=webp` pin below, not from the quality number. Raise this only against a
 * measurement, not a hunch.
 */
export const SANITY_IMAGE_QUALITY = 75;

interface BuildSanityImageUrlOptions {
	width: number;
	quality?: number;
	/**
	 * A DELIBERATE crop ratio -- `customRatio`, nothing else. It becomes the `h`
	 * parameter, which is what makes the builder emit a hotspot-centred rect.
	 *
	 * Never pass an image's natural ratio here "for symmetry": `h` is rounded per
	 * srcset candidate, so a ratio the image already has still comes back as a
	 * slightly-off one and the builder crops to the difference. Measured on a
	 * 2400x1600 asset, feeding it its own 1.5 produced `rect=0,13,2400,1575` at
	 * one candidate and no rect at another -- a 25px crop invented by rounding,
	 * varying by viewport. With a real `customRatio` the same rounding moves the
	 * rect by 1-2px, which is the honest cost of cropping at all.
	 */
	cropRatio?: number;
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
	{ hex?: string | null; rgb?: Partial<SanityRgb> | null } | null | undefined;

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

/**
 * One srcset candidate's URL, straight from the Sanity CDN.
 *
 * Called once per width `next/image` asks for, through the `loader` prop on
 * `SanityImage` -- so this is the ONLY encode an image gets. It replaced a builder
 * that asked for the asset's NATIVE width and handed the result to
 * `/_next/image`, which re-fetched and re-encoded it: two lossy passes for one
 * image. Measured on a 1080px product shot against its source PNG, the double
 * pass scored 39.56 dB PSNR at 6,683 bytes and a single pass 46.84 dB at 8,708.
 *
 * Three details are load-bearing:
 *
 * - **No `.format()`.** `fm` beats `auto=format`, so the old `fm=webp` pinned every
 *   image to webp and no browser ever saw the AVIF this CDN will serve. Same width,
 *   same quality, that shot went from 14,524 bytes to 8,708 on the `fm` alone.
 *   `auto=format` picks whichever codec is smaller PER REQUEST, negotiated against
 *   the real browser `Accept` -- which only works now that the browser is the
 *   fetcher; while `/_next/image` sat in front, the Accept header it saw was the
 *   optimizer's. Do not try to force the winner -- `fm=avif` is not in the
 *   allowlist (the CDN answers 400), so naming any format can only ever forgo the
 *   AVIF.
 *
 *   Which codec comes back does NOT track the quality number, whatever a quick
 *   probe suggests: a cold read can be served a stale variant, so the same URL
 *   answered `image/webp 17682` at `x-varnish-age: 18` and `image/avif 10300` on
 *   the immediate retry. Four prod assets read cold gave webp at both q75 and q82,
 *   and the same four read warm gave AVIF at both. Read any format comparison
 *   twice before drawing a conclusion from it, and do not tune the quality above
 *   to stay on one codec -- that is cache state, not the encoder.
 *
 *   The cost, taken deliberately: `auto=format` falls back to the ORIGINAL format
 *   when the client names no modern one, and these uploads are PNGs -- so a bare
 *   `Accept: image` wildcard now gets 508KB where `fm=webp` guaranteed 14.5KB.
 *   Every browser in use names `image/webp` (Chrome 32, Firefox 65, Safari 14), so
 *   that reaches bots and header-less fetchers only. The metadata and JSON-LD
 *   builders are unaffected -- they call `urlForImage` directly and still pin
 *   `.format('webp')`, which is the right call for a social scraper.
 *
 * - **`.height()` is what makes crop and hotspot work, so `ratio` is not optional
 *   in spirit.** The builder's `fit()` short-circuits on
 *   `if (!(imgWidth && imgHeight)) return { rect: source.crop }` -- given a width
 *   alone it emits the raw crop rectangle and never looks at the hotspot at all.
 *   Given both, it computes a hotspot-centred rect AT the requested aspect ratio.
 *   So on a 1080x1080 asset with the 16:9 crop selected, `.width(1080)` alone
 *   yields `?w=1080&fit=max` -- no rect, square image, hotspot ignored -- while
 *   `.width(1080).height(608)` yields `?rect=0,236,1080,608&w=1080&h=608&fit=max`,
 *   the crop the editor actually asked for.
 *
 *   The declared box has to agree with the bytes, or the browser squashes one
 *   into the other wherever no `object-fit` class covers for it (PageEventSingle's
 *   hero is exactly that call site). That is why callers size their `height`
 *   attribute off `resolveRenderedRatio` below rather than off
 *   `metadata.dimensions.aspectRatio`, which describes the UNCROPPED asset.
 *
 *   Do NOT be tempted to drop the height because `fit=max` looks like it shrinks:
 *   a hand-built `?w=1080&h=608&fit=max` with no rect does return 608x608, but
 *   that URL never occurs here -- the builder always computes the rect first, and
 *   `fit=max` then bounds the already-cropped 1080x608 region.
 *
 * - **The whole image object goes to `imageBuilder.image()`**, not a URL string, so
 *   `crop` and `hotspot` from `imageMetaFields` apply -- the hotspot only when
 *   `ratio` is passed, per the note above.
 */
/**
 * The aspect ratio an image will actually be delivered at, which is what a
 * caller's `height` attribute has to describe.
 *
 * Three cases, in order. A `customRatio` wins, because `buildSanityImageUrl` will
 * crop to it. Otherwise an authored crop narrows the asset's own ratio -- and
 * `metadata.dimensions.aspectRatio` describes the asset BEFORE that crop, so
 * using it raw is how a cropped image ends up declaring a box it does not fill.
 * Failing both, the asset's ratio is the answer.
 */
export function resolveRenderedRatio(
	aspectRatio: number | null | undefined,
	crop?: {
		top?: number;
		bottom?: number;
		left?: number;
		right?: number;
	} | null,
	customRatio?: number | null
): number | undefined {
	if (customRatio) return customRatio;
	if (!aspectRatio) return undefined;

	const horizontal = 1 - (crop?.left ?? 0) - (crop?.right ?? 0);
	const vertical = 1 - (crop?.top ?? 0) - (crop?.bottom ?? 0);
	if (horizontal <= 0 || vertical <= 0) return aspectRatio;

	return (aspectRatio * horizontal) / vertical;
}

export function buildSanityImageUrl(
	image: SanityImageSource | null | undefined,
	{
		width,
		quality = SANITY_IMAGE_QUALITY,
		cropRatio,
	}: BuildSanityImageUrlOptions
): string {
	if (!image) {
		return '';
	}

	try {
		const builder = urlForImage(image).width(Math.round(width));

		return (cropRatio ? builder.height(Math.round(width / cropRatio)) : builder)
			.quality(quality)
			.fit('max')
			.auto('format')
			.url();
	} catch (error) {
		console.error('Error building image source:', error);
		return '';
	}
}

export function buildRgbaCssString(color: MaybeSanityColor): string | false {
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
