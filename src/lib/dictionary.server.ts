import 'server-only';
import en from '@/dictionaries/en.json';
import type { Dictionary } from './dictionary';
import type { Locale } from './i18n';

const dictionaries = {
	en: () => Promise.resolve(en as Dictionary),
	zh_tw: () =>
		import('@/dictionaries/zh_tw.json').then((m) => m.default as Dictionary),
} satisfies Record<Locale, () => Promise<Dictionary>>;

// Falls back to English for a `locale` outside LOCALES: a page under [locale]
// renders concurrently with the layout's `notFound()`, and a throw here would
// win that race and turn the 404 into a 500 (see [locale]/layout.tsx).
export const getDictionary = (locale: Locale): Promise<Dictionary> =>
	(dictionaries[locale] ?? dictionaries.en)();
