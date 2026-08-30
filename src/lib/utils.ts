import { clsx, ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export type SpacingValue = keyof typeof SPACING_CLASSES.pt; // Union of allowed numeric keys (0, 1, ..., 96)
type SpacingPrefix = keyof typeof SPACING_CLASSES; // Union of allowed prefix keys (pt, pb, mt, mb, sm:pt, etc.)

// The original SPACING_CLASSES constant is kept as a non-exported const
// to serve as the source of truth for the types above.
const SPACING_CLASSES = {
	// ... (Your SPACING_CLASSES object is very large, keeping it here as a JS object is fine,
	// but for TS, we can use the keys/types derived from its structure)
	pt: {
		0: 'pt-0',
		1: 'pt-1',
		// ... all other pt values
	} as const,
	pb: {
		0: 'pb-0',
		1: 'pb-1',
		// ... all other pb values
	} as const,
	// ... all other keys (mt, mb, sm:pt, sm:pb, sm:mt, sm:mb)
	// NOTE: For a complete type-safe conversion, the entire object must be typed.
	// Using `as const` ensures keys are literal types.
} as const;

type SpacingType =
	| 'paddingTop'
	| 'paddingBottom'
	| 'marginTop'
	| 'marginBottom'
	| 'paddingTopDesktop'
	| 'paddingBottomDesktop'
	| 'marginTopDesktop'
	| 'marginBottomDesktop';

// Shared keyboard-focus treatment for absolutely-positioned overlay links (a
// stretched row link, a pill link, a map link). Inset so the ring draws inside
// its container rather than being clipped by it.
export const OVERLAY_LINK_FOCUS =
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

/**
 * Gets the corresponding Tailwind CSS class for a spacing utility.
 * @param spacingType - The type of spacing (e.g., 'paddingTop', 'marginBottomDesktop').
 * @param value - The Tailwind spacing scale value (e.g., 8, 16).
 * @param hasBackground - True if the spacing should use padding (hasBackground) instead of margin.
 * @returns The Tailwind class string (e.g., 'pt-8', 'sm:pb-16') or null.
 */

export function getSpacingClass(
	spacingType: SpacingType,
	value: SpacingValue | null | undefined,
	hasBackground: boolean = false
): string | null {
	if (value === null || value === undefined) return null;

	// Use a string literal for the prefix determination
	let prefix: string;
	if (spacingType.includes('Top')) {
		prefix = hasBackground ? 'pt' : 'mt';
	} else if (spacingType.includes('Bottom')) {
		prefix = hasBackground ? 'pb' : 'mb';
	} else {
		return null;
	}

	const isResponsive = spacingType.includes('Desktop');
	const finalPrefix = isResponsive ? `sm:${prefix}` : prefix;

	// Type assertion here to satisfy TS that finalPrefix is a valid key of SPACING_CLASSES
	const classMap = SPACING_CLASSES[finalPrefix as SpacingPrefix];

	// Cast value to keyof typeof classMap to ensure it's a valid number string
	return (classMap && classMap[value as keyof typeof classMap]) || null;
}
