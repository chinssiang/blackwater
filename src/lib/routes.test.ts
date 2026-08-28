import { describe, expect, it } from 'vitest';
import { stripLocaleFromHref, stripLocaleFromPathname } from '@/lib/i18n';
import {
	checkIfLinkIsActive,
	isLightThemePath,
	shouldHideGlobalNewsletter,
} from '@/lib/routes';

// These cover the one thing about this module that is invisible at a call site:
// a pathname and an href disagree about the DEFAULT locale prefix. proxy.ts
// rewrites the public "/products/x" onto the internal "/en/products/x", so a
// prerender's pathname carries "/en" and the browser's never does — while in an
// authored href "/en/..." is a real path segment that must survive.

describe('stripLocaleFromPathname', () => {
	it('strips the default locale prefix so both sides of hydration agree', () => {
		expect(stripLocaleFromPathname('/en/products/x').path).toBe('/products/x');
		expect(stripLocaleFromPathname('/products/x').path).toBe('/products/x');
	});

	it('strips a non-default locale prefix', () => {
		expect(stripLocaleFromPathname('/zh_tw/products/x').path).toBe(
			'/products/x'
		);
	});

	it('maps a bare locale prefix to the root path', () => {
		expect(stripLocaleFromPathname('/en').path).toBe('/');
		expect(stripLocaleFromPathname('/zh_tw').path).toBe('/');
		expect(stripLocaleFromPathname('/').path).toBe('/');
	});

	it('reports the locale it stripped, defaulting when there is no prefix', () => {
		expect(stripLocaleFromPathname('/zh_tw/faq').locale).toBe('zh_tw');
		expect(stripLocaleFromPathname('/en/faq').locale).toBe('en');
		expect(stripLocaleFromPathname('/faq').locale).toBe('en');
	});

	it('only strips a prefix on a segment boundary', () => {
		expect(stripLocaleFromPathname('/enigma').path).toBe('/enigma');
	});
});

describe('stripLocaleFromHref', () => {
	it('keeps a default-locale prefix, which in an href is a real segment', () => {
		expect(stripLocaleFromHref('/en/products/x').path).toBe('/en/products/x');
		expect(stripLocaleFromHref('/en').path).toBe('/en');
	});

	it('still strips a non-default locale prefix', () => {
		expect(stripLocaleFromHref('/zh_tw/products/x').path).toBe('/products/x');
		expect(stripLocaleFromHref('/zh_tw').path).toBe('/');
	});
});

describe('isLightThemePath', () => {
	it('agrees across the prerender and browser forms of the same route', () => {
		for (const p of ['/en/products/x', '/products/x', '/zh_tw/products/x']) {
			expect(isLightThemePath(p)).toBe(true);
		}
	});

	it('matches a light section and its descendants, with or without a trailing slash', () => {
		expect(isLightThemePath('/products')).toBe(true);
		expect(isLightThemePath('/en/products/')).toBe(true);
		expect(isLightThemePath('/en/products///')).toBe(true);
		expect(isLightThemePath('/size-guide')).toBe(true);
	});

	it('leaves every other route dark', () => {
		for (const p of ['/', '/en', '/en/events', '/events', '/en/contact']) {
			expect(isLightThemePath(p)).toBe(false);
		}
	});

	it('does not match a route that merely starts with the same characters', () => {
		expect(isLightThemePath('/productsomething')).toBe(false);
	});
});

describe('shouldHideGlobalNewsletter', () => {
	it('hides it on the newsletter route in either pathname form', () => {
		expect(shouldHideGlobalNewsletter('/en/newsletter')).toBe(true);
		expect(shouldHideGlobalNewsletter('/newsletter')).toBe(true);
		expect(shouldHideGlobalNewsletter('/zh_tw/newsletter')).toBe(true);
	});

	it('keeps it everywhere else, including descendants of an exact-match entry', () => {
		expect(shouldHideGlobalNewsletter('/en/contact')).toBe(false);
		expect(shouldHideGlobalNewsletter('/en/newsletter/thanks')).toBe(false);
	});
});

describe('checkIfLinkIsActive', () => {
	it('matches a section link on its own page and on descendants', () => {
		expect(
			checkIfLinkIsActive({ pathName: '/products', url: '/products' })
		).toBe(true);
		expect(
			checkIfLinkIsActive({ pathName: '/products/x', url: '/products' })
		).toBe(true);
		expect(checkIfLinkIsActive({ pathName: '/faq', url: '/products' })).toBe(
			false
		);
	});

	it('matches when the prerender pathname carries the default locale', () => {
		expect(
			checkIfLinkIsActive({ pathName: '/en/products/x', url: '/products' })
		).toBe(true);
	});

	it('tolerates the trailing slash GROQ puts on authored hrefs', () => {
		expect(checkIfLinkIsActive({ pathName: '/events', url: '/events/' })).toBe(
			true
		);
	});

	it('ignores a query string or fragment on the href', () => {
		expect(
			checkIfLinkIsActive({ pathName: '/size-guide', url: '/size-guide#tops' })
		).toBe(true);
		expect(
			checkIfLinkIsActive({ pathName: '/products', url: '/products?page=2' })
		).toBe(true);
	});

	it('keeps the home link active only on the home page', () => {
		expect(checkIfLinkIsActive({ pathName: '/', url: '/' })).toBe(true);
		expect(checkIfLinkIsActive({ pathName: '/en', url: '/' })).toBe(true);
		expect(checkIfLinkIsActive({ pathName: '/products', url: '/' })).toBe(
			false
		);
	});

	it('does not collapse an href of "/en" into the home link', () => {
		// A pGeneral page slugged "en". Normalizing the href like a pathname would
		// turn this into "/", making Home active here and this link never active.
		expect(checkIfLinkIsActive({ pathName: '/en', url: '/en' })).toBe(false);
		expect(checkIfLinkIsActive({ pathName: '/en/en', url: '/en' })).toBe(true);
	});

	it('never activates an external href', () => {
		expect(
			checkIfLinkIsActive({
				pathName: '/',
				url: 'https://www.instagram.com/blackwater.rc/',
			})
		).toBe(false);
	});

	it('returns false when either side is missing', () => {
		expect(checkIfLinkIsActive({ pathName: '', url: '/products' })).toBe(false);
		expect(checkIfLinkIsActive({ pathName: '/products', url: '' })).toBe(false);
	});

	it('does not serve a stale answer from the pathname cache', () => {
		// normalizeRoutePath memoizes the last pathname it saw; alternating inputs
		// would expose a cache that ignores its key.
		expect(
			checkIfLinkIsActive({ pathName: '/products', url: '/products' })
		).toBe(true);
		expect(checkIfLinkIsActive({ pathName: '/events', url: '/products' })).toBe(
			false
		);
		expect(
			checkIfLinkIsActive({ pathName: '/products', url: '/products' })
		).toBe(true);
	});
});
