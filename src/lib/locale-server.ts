import { headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';

export async function resolveLocale(): Promise<Locale> {
	const headerList = await headers();
	const v = headerList.get('x-locale');
	return isLocale(v) ? v : DEFAULT_LOCALE;
}
