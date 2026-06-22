import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LOCALE,
	htmlLangFor,
	isLocale,
	isLocaleExemptPath,
	localePrefix,
	localizePath,
	ogLocaleFor,
	pickLocalizedValue,
	stripLocaleFromPath,
} from './i18n';

describe('isLocale', () => {
	it('accepts known locales and rejects everything else', () => {
		expect(isLocale('en')).toBe(true);
		expect(isLocale('zh_tw')).toBe(true);
		expect(isLocale('fr')).toBe(false);
		expect(isLocale(undefined)).toBe(false);
		expect(isLocale(42)).toBe(false);
	});
});

describe('pickLocalizedValue', () => {
	it('returns a non-empty string as-is', () => {
		expect(pickLocalizedValue('hello')).toBe('hello');
	});

	it('treats an empty string as undefined', () => {
		expect(pickLocalizedValue('')).toBeUndefined();
	});

	it('returns the first non-empty value from an internationalizedArray', () => {
		expect(
			pickLocalizedValue([
				{ value: '' },
				{ value: 'zh' },
				{ value: 'en' },
			])
		).toBe('zh');
	});

	it('returns undefined for arrays with no usable value', () => {
		expect(pickLocalizedValue([{ value: '' }, { other: 1 }])).toBeUndefined();
		expect(pickLocalizedValue(null)).toBeUndefined();
		expect(pickLocalizedValue({})).toBeUndefined();
	});
});

describe('locale prefixing', () => {
	it('produces no prefix for the default locale', () => {
		expect(localePrefix(DEFAULT_LOCALE)).toBe('');
		expect(localePrefix('zh_tw')).toBe('/zh_tw');
	});

	it('localizes paths, handling the root specially', () => {
		expect(localizePath('/', 'en')).toBe('/');
		expect(localizePath('/', 'zh_tw')).toBe('/zh_tw');
		expect(localizePath('/products', 'zh_tw')).toBe('/zh_tw/products');
		// Path without a leading slash still produces a valid joined path.
		expect(localizePath('products', 'zh_tw')).toBe('/zh_tw/products');
	});
});

describe('stripLocaleFromPath', () => {
	it('extracts a non-default locale and the remaining path', () => {
		expect(stripLocaleFromPath('/zh_tw/products')).toEqual({
			locale: 'zh_tw',
			path: '/products',
		});
		expect(stripLocaleFromPath('/zh_tw')).toEqual({
			locale: 'zh_tw',
			path: '/',
		});
	});

	it('defaults to the default locale when no prefix is present', () => {
		expect(stripLocaleFromPath('/products')).toEqual({
			locale: 'en',
			path: '/products',
		});
	});

	it('round-trips with localizePath', () => {
		const localized = localizePath('/events/race-1', 'zh_tw');
		expect(stripLocaleFromPath(localized)).toEqual({
			locale: 'zh_tw',
			path: '/events/race-1',
		});
	});
});

describe('html and og locale tags', () => {
	it('maps locales to BCP-47 / OG forms', () => {
		expect(htmlLangFor('en')).toBe('en');
		expect(htmlLangFor('zh_tw')).toBe('zh-TW');
		expect(ogLocaleFor('en')).toBe('en_US');
		expect(ogLocaleFor('zh_tw')).toBe('zh_TW');
	});
});

describe('isLocaleExemptPath', () => {
	it('matches exempt prefixes and their descendants regardless of locale', () => {
		expect(isLocaleExemptPath('/events-crew')).toBe(true);
		expect(isLocaleExemptPath('/events-crew/june')).toBe(true);
		expect(isLocaleExemptPath('/email-signature')).toBe(true);
		expect(isLocaleExemptPath('/zh_tw/events-crew')).toBe(true);
	});

	it('does not match non-exempt paths', () => {
		expect(isLocaleExemptPath('/events')).toBe(false);
		expect(isLocaleExemptPath('/')).toBe(false);
	});
});
