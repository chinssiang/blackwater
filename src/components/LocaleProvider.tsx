'use client';

import { type ReactNode, createContext, useContext } from 'react';
import type { Dictionary } from '@/lib/dictionary';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';

const LocaleContext = createContext<{
	locale: Locale;
	dictionary: Dictionary | null;
}>({ locale: DEFAULT_LOCALE, dictionary: null });

export function LocaleProvider({
	locale,
	dictionary,
	children,
}: {
	locale: Locale;
	dictionary: Dictionary;
	children: ReactNode;
}) {
	return (
		<LocaleContext.Provider value={{ locale, dictionary }}>
			{children}
		</LocaleContext.Provider>
	);
}

export function useLocale(): Locale {
	return useContext(LocaleContext).locale;
}

export function useDictionary(): Dictionary {
	const { dictionary } = useContext(LocaleContext);
	if (!dictionary)
		throw new Error('useDictionary must be used within LocaleProvider');
	return dictionary;
}

export function useTranslations<K extends keyof Dictionary>(
	namespace: K
): Dictionary[K] {
	return useDictionary()[namespace];
}
