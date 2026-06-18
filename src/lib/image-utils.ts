import { imageBuilder } from '@/sanity/lib/image';

interface BuildImageOptions {
	width?: number;
	height?: number;
	format?: 'jpg' | 'pjpg' | 'png' | 'webp';
	quality?: number;
}

interface BuildImageSrcSetOptions extends BuildImageOptions {
	srcSizes: number[];
	aspectRatio?: number;
}

interface SanityRgb {
	r: number;
	g: number;
	b: number;
	a: number;
}

interface SanityColor {
	hex: string;
	rgb: SanityRgb;
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

export function buildImageSrcSet(
	image: any,
	{ srcSizes, aspectRatio = 1, format, quality = 80 }: BuildImageSrcSetOptions
): string | false {
	if (!image || !srcSizes || srcSizes.length === 0) {
		return false;
	}

	try {
		const sizes = srcSizes
			.map((width) => {
				const height = aspectRatio
					? Math.round((width * aspectRatio) / 100)
					: undefined;

				const imgSrc = buildImageSrc(image, { width, height, format, quality });

				return imgSrc ? `${imgSrc} ${width}w` : '';
			})
			.filter(Boolean);

		return sizes.length ? sizes.join(',') : false;
	} catch (error) {
		console.error('Error building image srcset:', error);
		return false;
	}
}

export function buildRgbaCssString(
	color: SanityColor | null | undefined
): string | false {
	if (!color) {
		return false;
	}

	const r = color?.rgb?.r ?? 255;
	const g = color?.rgb?.g ?? 255;
	const b = color?.rgb?.b ?? 255;
	const a = color?.rgb?.a ?? 1;

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
// fall back to a legible neutral so the label stays readable. Returns false only
// when there is no background to test against and no author text color.
const LEGIBLE_DARK = 'rgb(23, 23, 23)';
const LEGIBLE_LIGHT = 'rgb(245, 245, 245)';

export function ensureAccessibleTextColor(
	textColor: SanityColor | null | undefined,
	bgColor: SanityColor | null | undefined
): string | false {
	if (!bgColor?.rgb) {
		// No concrete background to measure against; defer to the author's color.
		return buildRgbaCssString(textColor);
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
