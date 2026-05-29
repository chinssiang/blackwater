import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n';

const NON_DEFAULT_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);
const PASSTHROUGH_PREFIXES = ['/email-signature', '/events-crew'];

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
	matcher: ['/((?!api|sanity|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
