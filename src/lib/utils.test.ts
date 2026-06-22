import { describe, expect, it, vi } from 'vitest';
import {
	appendReferralParams,
	arrayCartesian,
	arrayIntersection,
	arraySortObjValAsc,
	arraySortObjValDesc,
	arrayUniqueValues,
	cn,
	formatClamp,
	formatDateUsStandard,
	formatHandleize,
	formatNumberEuro,
	formatNumberSuffix,
	formatNumberWithCommas,
	formatObjectToHtml,
	formatPad,
	formatUrl,
	getUrlBaseAndPath,
	hasArrayValue,
	isValidUrl,
	slugify,
	toCamelCase,
	validateAndReturnJson,
	validateEmail,
	validateUsPhone,
} from './utils';

describe('cn', () => {
	it('merges classes and drops falsy values', () => {
		expect(cn('a', false && 'b', 'c')).toBe('a c');
	});

	it('lets later Tailwind classes win conflicts', () => {
		expect(cn('p-2', 'p-4')).toBe('p-4');
	});
});

describe('formatNumberSuffix', () => {
	it('applies the correct ordinal suffix', () => {
		expect(formatNumberSuffix(1)).toBe('1st');
		expect(formatNumberSuffix(2)).toBe('2nd');
		expect(formatNumberSuffix(3)).toBe('3rd');
		expect(formatNumberSuffix(4)).toBe('4th');
		expect(formatNumberSuffix(21)).toBe('21st');
		expect(formatNumberSuffix(22)).toBe('22nd');
	});

	it('handles the 11-13 special case', () => {
		expect(formatNumberSuffix(11)).toBe('11th');
		expect(formatNumberSuffix(12)).toBe('12th');
		expect(formatNumberSuffix(13)).toBe('13th');
	});

	it('returns only the suffix when requested', () => {
		expect(formatNumberSuffix(1, true)).toBe('st');
		expect(formatNumberSuffix(13, true)).toBe('th');
	});

	it('returns an empty string for non-numeric input', () => {
		expect(formatNumberSuffix('abc')).toBe('');
	});
});

describe('formatHandleize', () => {
	it('strips accents, lowercases and hyphenates', () => {
		expect(formatHandleize('Héllo World!')).toBe('hello-world');
	});

	it('collapses consecutive hyphens', () => {
		expect(formatHandleize('a   b')).toBe('a-b');
	});
});

describe('slugify', () => {
	it('produces a url-friendly slug', () => {
		expect(slugify('Héllo World!')).toBe('hello-world');
	});

	it('returns undefined for nullish or empty-after-trim input', () => {
		expect(slugify(null)).toBeUndefined();
		expect(slugify(undefined)).toBeUndefined();
		expect(slugify('   ')).toBeUndefined();
	});
});

describe('toCamelCase', () => {
	it('converts separated words to camelCase', () => {
		expect(toCamelCase('hello world')).toBe('helloWorld');
		expect(toCamelCase('Foo Bar')).toBe('fooBar');
	});

	it('returns an empty string for nullish input', () => {
		expect(toCamelCase(null)).toBe('');
		expect(toCamelCase('')).toBe('');
	});
});

describe('formatPad', () => {
	it('pads to the requested length with the given character', () => {
		expect(formatPad(5)).toBe('05');
		expect(formatPad(5, 3)).toBe('005');
		expect(formatPad('5', 4, 'x')).toBe('xxx5');
	});
});

describe('formatClamp', () => {
	it('clamps within the inclusive range', () => {
		expect(formatClamp(999, 0, 300)).toBe(300);
		expect(formatClamp(-5, 0, 1)).toBe(0);
		expect(formatClamp(0.5)).toBe(0.5);
	});
});

describe('number formatting', () => {
	it('inserts thousands separators (US)', () => {
		expect(formatNumberWithCommas(3000.12)).toBe('3,000.12');
		expect(formatNumberWithCommas(1000000)).toBe('1,000,000');
	});

	it('inserts thousands separators (Euro)', () => {
		expect(formatNumberEuro(3000.12)).toBe('3 000,12');
	});
});

describe('formatDateUsStandard', () => {
	it('formats as DD/MM/YYYY with zero padding', () => {
		// Construct in local time to avoid timezone drift.
		expect(formatDateUsStandard(new Date(2025, 5, 9))).toBe('09/06/2025');
	});
});

describe('formatObjectToHtml', () => {
	it('returns a string input unchanged', () => {
		expect(formatObjectToHtml('plain')).toBe('plain');
	});

	it('title-cases keys and joins entries with <br>', () => {
		expect(
			formatObjectToHtml({ firstName: 'Bob', city: 'Taipei' })
		).toBe('First Name: Bob<br>City: Taipei');
	});

	it('strips question marks from keys', () => {
		expect(formatObjectToHtml({ 'attending?': 'yes' })).toBe('Attending: yes');
	});
});

describe('getUrlBaseAndPath', () => {
	it('drops the query string', () => {
		expect(getUrlBaseAndPath('https://x.com/p?q=1')).toBe('https://x.com/p');
	});

	it('returns the url unchanged when there is no query', () => {
		expect(getUrlBaseAndPath('https://x.com/p')).toBe('https://x.com/p');
	});
});

describe('formatUrl', () => {
	it('collapses duplicate slashes in the path but not the protocol', () => {
		expect(formatUrl('https://x.com//a//b')).toBe('https://x.com/a/b');
	});

	it('returns malformed input unchanged', () => {
		expect(formatUrl('not-a-url')).toBe('not-a-url');
	});
});

describe('appendReferralParams', () => {
	const params = { source: 'site', medium: 'referral', campaign: 'spring' };

	it('appends utm params', () => {
		const out = appendReferralParams('https://x.com/p', params);
		const url = new URL(out);
		expect(url.searchParams.get('utm_source')).toBe('site');
		expect(url.searchParams.get('utm_medium')).toBe('referral');
		expect(url.searchParams.get('utm_campaign')).toBe('spring');
	});

	it('never clobbers an existing param', () => {
		const out = appendReferralParams('https://x.com/p?utm_source=keep', params);
		expect(new URL(out).searchParams.get('utm_source')).toBe('keep');
	});

	it('returns the input unchanged when it cannot be parsed', () => {
		expect(appendReferralParams('not a url', params)).toBe('not a url');
	});
});

describe('validators', () => {
	it('validateEmail accepts well-formed addresses', () => {
		expect(validateEmail('test@example.com')).toBe(true);
		expect(validateEmail('a.b-c@sub.example.org')).toBe(true);
	});

	it('validateEmail rejects malformed addresses', () => {
		expect(validateEmail('invalid')).toBe(false);
		expect(validateEmail('a@b')).toBe(false);
	});

	it('validateUsPhone accepts common formats', () => {
		expect(validateUsPhone('(555) 123-4567')).toBe(true);
		expect(validateUsPhone('555-123-4567')).toBe(true);
		expect(validateUsPhone('5551234567')).toBe(true);
	});

	it('validateUsPhone rejects bad input', () => {
		expect(validateUsPhone('12345')).toBe(false);
	});

	it('isValidUrl accepts urls with or without protocol', () => {
		expect(isValidUrl('https://example.com')).toBe(true);
		expect(isValidUrl('example.com/path')).toBe(true);
	});

	it('isValidUrl rejects plain text', () => {
		expect(isValidUrl('just text')).toBe(false);
	});

	it('validateAndReturnJson parses valid JSON and returns false otherwise', () => {
		expect(validateAndReturnJson('{"a":1}')).toEqual({ a: 1 });
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(validateAndReturnJson('{bad}')).toBe(false);
		spy.mockRestore();
	});
});

describe('array helpers', () => {
	it('hasArrayValue distinguishes non-empty arrays', () => {
		expect(hasArrayValue([1])).toBe(true);
		expect(hasArrayValue([])).toBe(false);
		expect(hasArrayValue(null)).toBe(false);
	});

	it('arrayIntersection returns common elements', () => {
		expect(arrayIntersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
	});

	it('arrayUniqueValues dedupes', () => {
		expect(arrayUniqueValues([1, 1, 2, 3, 3])).toEqual([1, 2, 3]);
	});

	it('arraySortObjVal sorts ascending and descending', () => {
		const asc = arraySortObjValAsc([{ a: 2 }, { a: 1 }, { a: 3 }], 'a');
		expect(asc.map((o) => o.a)).toEqual([1, 2, 3]);
		const desc = arraySortObjValDesc([{ a: 2 }, { a: 1 }, { a: 3 }], 'a');
		expect(desc.map((o) => o.a)).toEqual([3, 2, 1]);
	});

	it('arrayCartesian produces all combinations', () => {
		expect(arrayCartesian([1, 2], [3, 4])).toEqual([
			[1, 3],
			[1, 4],
			[2, 3],
			[2, 4],
		]);
	});
});
