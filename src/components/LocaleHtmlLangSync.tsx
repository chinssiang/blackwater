'use client';

import { useEffect } from 'react';
import { htmlLangFor, type Locale } from '@/lib/i18n';

export function LocaleHtmlLangSync({ locale }: { locale: Locale }) {
	useEffect(() => {
		document.documentElement.lang = htmlLangFor(locale);
	}, [locale]);
	return null;
}
