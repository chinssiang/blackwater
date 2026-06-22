import { describe, expect, it } from 'vitest';
import defineMetadata, { normalizeLocales } from './defineMetadata';

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
		expect(meta.alternates?.canonical).toBe(
			'https://blackwaterrc.com/about'
		);
		expect(meta.robots).toMatchObject({ index: true, follow: true });
	});

	it('disables indexing when disableIndex is set', () => {
		const meta = defineMetadata({
			data: { _type: 'pGeneral', slug: 'secret', sharing: { disableIndex: true } },
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
			en: 'https://blackwaterrc.com/about',
			'zh-TW': 'https://blackwaterrc.com/zh_tw/about',
			'x-default': 'https://blackwaterrc.com/about',
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
