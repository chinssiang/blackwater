import { clsx, ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The type-scale classes defined in `globals.css`. They set a font-size, so
 * tailwind-merge has to know they conflict with `text-sm` and friends --
 * otherwise both survive the merge and the cascade decides, and the cascade
 * always picks the Tailwind utility, because the `t-*` rules live in
 * `@layer components`. That is how a `t-l-2` on a `<Button>` was silently
 * overridden by its base `text-sm`, and why four call sites had grown a size
 * restatement to force the rung back -- each one freezing it at a literal.
 *
 * `src/lib/type-scale.test.ts` fails if this list and the stylesheet disagree.
 */
export const TYPE_SCALE_CLASSES = [
	't-h-1',
	't-h-2',
	't-h-3',
	't-l-0',
	't-b-1',
	't-b-2',
	't-l-1',
	't-l-2',
	't-spec',
] as const;

/**
 * A rung sets BOTH font-size and line-height, so both groups are registered:
 * `DialogTitle`'s base `leading-none` used to survive a `t-h-3` beside it and
 * leave the size-chart title clipping at line-height 1.
 *
 * The conflict is deliberately ONE-WAY: a `t-*` clears a font-size or
 * `leading-*` utility before it, but one after a `t-*` clears nothing. A token
 * is meant to be overridable at a call site -- a `leading-*`, `font-medium` or
 * an explicit `text-*` written after one all still work -- so registering the
 * conflict in both directions would close the escape hatch the tokens are
 * designed around.
 *
 * One trap it cannot see: tailwind-merge resolves conflicts only WITHIN a
 * modifier scope, so a token beside a responsive pair keeps the half it did
 * not match. `<Input>`'s base is `text-base md:text-sm`; a `t-b-2` on one
 * would drop the unprefixed `text-base` and leave `md:text-sm` standing, so
 * the field would render below 16px on a phone and iOS would zoom the
 * viewport on focus. No call site does this today -- put the token on a
 * wrapper, or restate the mobile size, if one ever needs to.
 */
const twMerge = extendTailwindMerge<'type-scale'>({
	extend: {
		classGroups: { 'type-scale': [...TYPE_SCALE_CLASSES] },
		conflictingClassGroups: { 'type-scale': ['font-size', 'leading'] },
	},
});

// --- UTILITIES / GET ---

/**
 * Merges Tailwind classes using twMerge and clsx.
 * @param inputs - Array of class values (string, array, or object).
 * @returns The merged class string.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/**
 * Checks if a value is an Array and has elements.
 * @param arr - The value to check.
 * @returns True if the value is a non-empty array, otherwise false.
 */
export function hasArrayValue<T>(arr: T[] | null | undefined): arr is T[] {
	return Array.isArray(arr) && arr.length > 0;
}

// --- UTILITIES / FORMAT ---

/**
 * Converts a simple object's key-value pairs into a formatted HTML string with `<br>` separators.
 * Key names are converted to title case.
 * If a string is provided, it is returned as-is.
 * @param obj - The object (or string) to format.
 * @returns The HTML string.
 */
export function formatObjectToHtml(obj: Record<string, any> | string): string {
	if (typeof obj === 'string') {
		return obj;
	}

	return Object.entries(obj)
		.map(([key, value]) => {
			const formattedKey = key
				.replace(/([A-Z])/g, ' $1') // insert space before capital letters
				.replace(/^./, (str) => str.toUpperCase()) // capitalize first letter
				.replace(/\?/g, ''); // remove question marks from key

			return `${formattedKey}: ${value}`;
		})
		.join('<br>');
}

/**
 * Normalizes a URL by collapsing consecutive slashes in the path.
 * @param url - The input URL string.
 * @returns The normalized URL string.
 */
export function formatUrl(url: string): string {
	const parts = url.split('://');
	if (parts.length !== 2) {
		// If it doesn't match the expected format, return as is or handle error
		return url;
	}
	const [protocol, rest] = parts;

	// Replace multiple slashes with a single slash, unless it's immediately after the protocol (://)
	const normalizedRest = rest.replace(/\/{2,}/g, '/');
	return `${protocol}://${normalizedRest}`;
}

/** Source label that identifies our site in a destination's analytics. */
export const REFERRAL_SOURCE = 'blackwaterrc.com';

type ReferralParams = {
	source: string;
	medium: string;
	campaign: string;
	content?: string;
};

/**
 * Appends UTM campaign params to an outbound URL so the destination's analytics
 * can attribute the visit to us. Preserves existing query/hash and never clobbers
 * params already present on the URL. Returns the input unchanged if it can't be parsed.
 */
export function appendReferralParams(url: string, params: ReferralParams): string {
	try {
		const parsed = new URL(url);
		const utm: Record<string, string | undefined> = {
			utm_source: params.source,
			utm_medium: params.medium,
			utm_campaign: params.campaign,
			utm_content: params.content,
		};
		for (const [key, value] of Object.entries(utm)) {
			if (value && !parsed.searchParams.has(key)) {
				parsed.searchParams.set(key, value);
			}
		}
		return parsed.toString();
	} catch {
		return url;
	}
}

// --- UTILITIES / VALIDATION ---

/**
 * Validates a string against a common email regex pattern.
 * @param string - The string to validate.
 * @returns True if the string is a valid email, otherwise false.
 */
export function validateEmail(string: string): boolean {
	// Deliberately loose: one @, no whitespace, a dot in the domain with a 2+
	// char TLD. The old pattern rejected real addresses (`user+tag@gmail.com`,
	// 4+ char TLDs like .info); anything subtler is the mail provider's job.
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

	return regex.test(string);
}

// --- ACTIONS ---

/**
 * Disables scrolling on the document body by setting overflow to 'hidden'.
 */
export function scrollDisable(): void {
	document.documentElement.style.overflow = 'hidden';
	document.body.style.overflow = 'hidden';
}

/**
 * Re-enables scrolling by removing the inline overflow set by `scrollDisable`.
 * Removes the property rather than assigning a value, so the stylesheet's own
 * overflow rules take over again instead of being permanently overridden.
 */
export function scrollEnable(): void {
	document.documentElement.style.removeProperty('overflow');
	document.body.style.removeProperty('overflow');
}

/**
 * Converts a string into a URL-friendly slug.
 * @param str - The string to slugify.
 * @returns The slugified string or undefined if input is null/empty.
 */
export function slugify(str: string | null | undefined): string | undefined {
	if (str === null || str === undefined) return undefined;

	// Normalize and trim early; if empty after trim, return fallback
	const base = String(str)
		.normalize('NFKD') // split accented characters into their base characters and diacritical marks
		.replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
		.trim(); // trim leading or trailing whitespace
	if (!base) return undefined;

	const slug = base
		.toLowerCase() // convert to lowercase
		.replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
		.replace(/\s+/g, '-') // spaces → hyphen
		.replace(/-+/g, '-'); // collapse hyphens

	return slug;
}

/**
 * Simple validation for a URL string.
 * @param urlString - The string to validate.
 * @returns True if the string is a valid URL, otherwise false.
 */
export function isValidUrl(urlString: string): boolean {
	const urlPattern = new RegExp(
		'^(https?:\\/\\/)?' + // validate protocol
			'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // validate domain name
			'((\\d{1,3}\\.){3}\\d{1,3}))' + // validate OR ip (v4) address
			'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // validate port and path
			'(\\?[;&a-z\\d%_.~+=-]*)?', // validate query string
		'i'
	);
	return !!urlPattern.test(urlString);
}

// --- TAILWIND UTILITIES ---

// Shared keyboard-focus treatment for absolutely-positioned overlay links (a
// stretched row link, a pill link). Inset so the ring draws inside its
// container rather than being clipped by it.
export const OVERLAY_LINK_FOCUS =
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

// The same treatment for a link that sits in normal flow rather than over a
// container -- a `ring-inset` ring on an 11px inline box draws over the glyphs,
// and fragments across line boxes once the link's text can wrap.
export const INLINE_LINK_FOCUS =
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-ring';

export const SECTION_INSET = 'p-x-max';
// A padding on the carousel TRACK, deliberately not on the viewport: the
// viewport stays full-bleed so slides run off both screen edges. That means
// this inset scrolls away with the track, and its consumer has to add it back
// to every snap through embla's `align` -- see EventsCarousel, which reads
// this padding back off the track rather than restating `--padding-max`.
export const SECTION_INSET_START = 'pl-(--padding-max)';
export const SECTION_INSET_TRAILING_SLIDE = 'last:mr-contain';
