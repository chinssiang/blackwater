import { describe, expect, it } from 'vitest';
import defineMetadata, { normalizeLocales } from './defineMetadata';

// defineMetadata is the one SITE_URL reader with no hardcoded fallback, so
// these assertions are what would catch an unset SITE_URL emitting
// "undefined/about" into a canonical tag. vitest.config.ts supplies the value.
const siteUrl = 'https://example.test';

describe('normalizeLocales', () => {
	it('dedupes and filters to valid locales', () => {
		expect(normalizeLocales(['en', 'en', 'zh_tw', 'fr'])).toEqual([
			'en',
			'zh_tw',
		]);
	});

	it('falls back to the default locale for empty/invalid input', () => {
		expect(normalizeLocales(null)).toEqual(['en']);
		expect(normalizeLocales(['fr', 'de'])).toEqual(['en']);
	});
});

describe('defineMetadata', () => {
	it('builds canonical url and robots from sharing fields', () => {
		const meta = defineMetadata({
			data: {
				_type: 'pGeneral',
				slug: 'about',
				sharing: { metaTitle: 'About', metaDesc: 'About us' },
			},
		});
		expect(meta.title).toBe('About');
		expect(meta.description).toBe('About us');
		expect(meta.alternates?.canonical).toBe(`${siteUrl}/about`);
		expect(meta.robots).toMatchObject({ index: true, follow: true });
	});

	it('disables indexing when disableIndex is set', () => {
		const meta = defineMetadata({
			data: {
				_type: 'pGeneral',
				slug: 'secret',
				sharing: { disableIndex: true },
			},
		});
		expect(meta.robots).toMatchObject({ index: false, follow: false });
	});

	it('uses an absolute title on the homepage', () => {
		const meta = defineMetadata({
			data: { isHomepage: true, sharing: { metaTitle: 'Blackwater RC' } },
		});
		expect(meta.title).toEqual({ absolute: 'Blackwater RC' });
	});

	it('builds an hreflang map when multiple locales are available', () => {
		const meta = defineMetadata({
			data: { _type: 'pGeneral', slug: 'about', sharing: {} },
			locale: 'en',
			availableLocales: ['en', 'zh_tw'],
		});
		expect(meta.alternates?.languages).toEqual({
			en: `${siteUrl}/about`,
			'zh-TW': `${siteUrl}/zh_tw/about`,
			'x-default': `${siteUrl}/about`,
		});
	});

	it('omits the hreflang map for single-locale documents', () => {
		const meta = defineMetadata({
			data: { _type: 'pGeneral', slug: 'about', sharing: {} },
			availableLocales: ['en'],
		});
		expect(meta.alternates?.languages).toBeUndefined();
	});
});
