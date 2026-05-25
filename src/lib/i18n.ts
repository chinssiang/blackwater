export const LOCALES = ['en', 'zh_tw'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
	en: 'English',
	zh_tw: '中文',
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
	en: 'EN',
	zh_tw: '中文',
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

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
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

export function stripLocaleFromPath(path: string): { locale: Locale; path: string } {
	for (const locale of LOCALES) {
		if (locale === DEFAULT_LOCALE) continue;
		const prefix = `/${locale}`;
		if (path === prefix) return { locale, path: '/' };
		if (path.startsWith(`${prefix}/`)) return { locale, path: path.slice(prefix.length) };
	}
	return { locale: DEFAULT_LOCALE, path };
}

