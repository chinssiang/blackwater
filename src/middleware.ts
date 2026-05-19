import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n';

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Extract locale from the first path segment, e.g. /zh_tw/contact → zh_tw
	const firstSegment = pathname.split('/')[1];
	const locale = (LOCALES as readonly string[]).includes(firstSegment)
		? firstSegment
		: DEFAULT_LOCALE;

	const response = NextResponse.next();
	response.headers.set('x-locale', locale);
	return response;
}

export const config = {
	// Run on all frontend routes; skip Next.js internals, static files, and the Sanity Studio.
	matcher: ['/((?!_next|sanity|api|favicon|fonts|.*\\..*).*)'],
};
