import {
	type MaybeSanityColor,
	buildRgbaCssString,
	ensureAccessibleTextColor,
} from '@/lib/image-utils';

const DEFAULT_INTERVAL_SECONDS = 10;
// Floor for an authored interval, so a tiny or negative value cannot flash.
const MIN_INTERVAL_SECONDS = 3;

export function announcementIntervalMs(
	seconds: number | null | undefined
): number {
	return (
		Math.max(seconds || DEFAULT_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS) * 1000
	);
}

// A live update can remove the message the visitor was on; fall back to the first.
export function clampMessageIndex(active: number, count: number): number {
	return active < count ? active : 0;
}

/**
 * The bar's authored colours as CSS values, or `false` for the theme default.
 * The paper keeps its authored alpha; the contrast check measures the rgb
 * channels as if opaque, so a very transparent paper is NOT guaranteed
 * legible over whatever scrolls beneath the bar.
 */
export function resolveAnnouncementColors({
	backgroundColor,
	textColor,
	emphasizeColor,
}: {
	backgroundColor: MaybeSanityColor;
	textColor: MaybeSanityColor;
	emphasizeColor: MaybeSanityColor;
}) {
	return {
		paper: buildRgbaCssString(backgroundColor),
		ink: ensureAccessibleTextColor(textColor, backgroundColor),
		emphasis:
			Boolean(emphasizeColor?.rgb) &&
			ensureAccessibleTextColor(emphasizeColor, backgroundColor),
	};
}
