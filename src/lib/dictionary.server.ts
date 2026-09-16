import en from '@/dictionaries/en.json';
import type { Dictionary } from './dictionary';
import type { Locale } from './i18n';
import 'server-only';

const dictionaries = {
	en: () => Promise.resolve(en as Dictionary),
	zh_tw: () =>
		import('@/dictionaries/zh_tw.json').then((m) => m.default as Dictionary),
} satisfies Record<Locale, () => Promise<Dictionary>>;

export const getDictionary = (locale: Locale): Promise<Dictionary> =>
	dictionaries[locale]();
