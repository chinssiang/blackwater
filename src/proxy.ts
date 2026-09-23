import { type NextRequest, NextResponse } from 'next/server';
import {
	DEFAULT_LOCALE,
	LOCALES,
	LOCALE_EXEMPT_PREFIXES,
	type Locale,
} from '@/lib/i18n';

const NON_DEFAULT_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);
// Plus the Studio picker's preview frames, which carry their own locale
// segment. They are not LOCALE_EXEMPT (they have a zh_tw variant), so they are
// listed here rather than there.
const PASSTHROUGH_PREFIXES = [...LOCALE_EXEMPT_PREFIXES, '/module-preview'];

const LOCALE_HEADER = 'x-locale';

function localeForPath(pathname: string): Locale | null {
	for (const locale of NON_DEFAULT_LOCALES) {
		const prefix = `/${locale}`;
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return locale;
	}
	return null;
}

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	for (const prefix of PASSTHROUGH_PREFIXES) {
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
			return NextResponse.next();
		}
	}

	const matchedLocale = localeForPath(pathname);

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set(LOCALE_HEADER, matchedLocale ?? DEFAULT_LOCALE);

	if (matchedLocale) {
		return NextResponse.next({ request: { headers: requestHeaders } });
	}

	const url = request.nextUrl.clone();
	url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
	return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
	matcher: [
		'/((?!(?:api|sanity)(?:/|$)|_next/static|_next/image|favicon.ico|.*\\..*).*)',
	],
};
