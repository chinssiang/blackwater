export const LOCALES = ['en', 'zh_tw'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
	en: 'English',
	zh_tw: '中文',
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
	en: 'EN',
	zh_tw: '繁',
};

export const SANITY_LANGUAGES = LOCALES.map((id) => ({
	id,
	title: LOCALE_LABELS[id],
}));

export function pickLocalizedValue(value: unknown): string | undefined {
	if (typeof value === 'string') return value || undefined;
	if (!Array.isArray(value)) return undefined;
	for (const entry of value) {
		if (entry && typeof entry.value === 'string' && entry.value.length > 0) {
			return entry.value;
		}
	}
	return undefined;
}

/**
 * Validators for internationalizedArray fields, which the plugin stores as
 * `[{_key, language, value}]`. They live here, not beside their first caller, so
 * schema files don't have to import one another to share them.
 */

/** True when any language carries a non-empty value. */
function hasSomeI18nValue(value: unknown): boolean {
	const items = Array.isArray(value) ? value : [];
	return items.some(
		(item) =>
			item &&
			typeof item === 'object' &&
			'value' in item &&
			Boolean((item as { value?: unknown }).value)
	);
}

/**
 * `Rule.required()` passes on an array of empty per-language items, so this is
 * the real requirement. Deliberately not "has English": zh-only documents exist
 * and simply stay hidden from the locales they carry no copy for.
 */
export function requireSomeValue(value: unknown): true | string {
	return hasSomeI18nValue(value) ? true : 'Required in at least one language';
}

/** True when an internationalizedArray field carries no copy in any language. */
export function isEmptyI18nValue(value: unknown): boolean {
	return !hasSomeI18nValue(value);
}

/**
 * `Rule.max(n)` can't reach inside the per-language items, so length caps go
 * through this instead. Returns a validator, so pass it to `Rule.custom(...)`.
 */
export function maxLengthPerLanguage(limit: number, message: string) {
	return (value: unknown): true | string => {
		const items = Array.isArray(value) ? value : [];
		const tooLong = items.some((item) => {
			const itemValue = (item as { value?: unknown })?.value;
			return typeof itemValue === 'string' && itemValue.length > limit;
		});
		return tooLong ? message : true;
	};
}

export function isLocale(value: unknown): value is Locale {
	return (
		typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
	);
}

export function htmlLangFor(locale: Locale): string {
	if (locale === 'zh_tw') return 'zh-TW';
	return 'en';
}

export function localePrefix(locale: Locale): string {
	return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

export function localizePath(path: string, locale: Locale): string {
	const prefix = localePrefix(locale);
	if (!prefix) return path;
	if (path === '/' || path === '') return prefix;
	return `${prefix}${path.startsWith('/') ? path : `/${path}`}`;
}

export function ogLocaleFor(locale: Locale): string {
	return locale === 'zh_tw' ? 'zh_TW' : 'en_US';
}

type StrippedLocale = { locale: Locale; path: string };

function stripLocale(path: string, includeDefault: boolean): StrippedLocale {
	for (const locale of LOCALES) {
		if (locale === DEFAULT_LOCALE && !includeDefault) continue;
		const prefix = `/${locale}`;
		if (path === prefix) return { locale, path: '/' };
		if (path.startsWith(`${prefix}/`))
			return { locale, path: path.slice(prefix.length) };
	}
	return { locale: DEFAULT_LOCALE, path };
}

// The two callers below differ on ONE axis — where the string came from — and
// that is the whole reason both exist. Pick by the source of your input, never
// by which name reads better:
//
//   href     -> stripLocaleFromHref      (authored or resolved link target)
//   pathname -> stripLocaleFromPathname  (anything out of usePathname())
//
// They disagree only about the DEFAULT locale prefix, which is exactly where
// getting it wrong is invisible: public URLs never carry "/en", so in an href
// "/en/..." is a real path segment and must survive — but proxy.ts rewrites the
// public "/products/x" onto the internal "/en/products/x", so a prerender's
// pathname DOES carry "/en" while the browser's never does. Stripping only
// non-default locales from a pathname left the two sides disagreeing and the
// build baked the prerender's answer into the HTML: that is how /products
// shipped dark and flipped to light on hydration, and how every English page
// shipped a "/zh_tw/en/..." language-switcher href.

/** For an authored or resolved href. Keeps a leading "/en/" as a real segment. */
export function stripLocaleFromHref(path: string): StrippedLocale {
	return stripLocale(path, false);
}

/** For a usePathname() value. Strips every locale prefix, default included. */
export function stripLocaleFromPathname(path: string): StrippedLocale {
	return stripLocale(path, true);
}

// Routes that exist only at the default locale (no /[locale] variant). The
// proxy passes these through without locale rewriting, so they have no
// translated counterpart. Single source of truth, shared with proxy.ts.
export const LOCALE_EXEMPT_PREFIXES = [
	'/email-signature',
	'/events-crew',
] as const;

export function isLocaleExemptPath(path: string): boolean {
	const { path: stripped } = stripLocaleFromPathname(path);
	return LOCALE_EXEMPT_PREFIXES.some(
		(prefix) => stripped === prefix || stripped.startsWith(`${prefix}/`)
	);
}
