import { describe, expect, it } from 'vitest';
import {
	appendReferralParams,
	cn,
	formatObjectToHtml,
	formatUrl,
	hasArrayValue,
	isValidUrl,
	slugify,
	validateEmail,
} from './utils';

// cn's tailwind-merge registration of the type-scale rungs is asserted in
// type-scale.test.ts, which also guards it against globals.css drifting.
describe('cn', () => {
	it('merges classes and drops falsy values', () => {
		expect(cn('a', false && 'b', 'c')).toBe('a c');
	});

	it('lets later Tailwind classes win conflicts', () => {
		expect(cn('p-2', 'p-4')).toBe('p-4');
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

describe('formatObjectToHtml', () => {
	it('returns a string input unchanged', () => {
		expect(formatObjectToHtml('plain')).toBe('plain');
	});

	it('title-cases keys and joins entries with <br>', () => {
		expect(formatObjectToHtml({ firstName: 'Bob', city: 'Taipei' })).toBe(
			'First Name: Bob<br>City: Taipei'
		);
	});

	it('strips question marks from keys', () => {
		expect(formatObjectToHtml({ 'attending?': 'yes' })).toBe('Attending: yes');
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
		const url = new URL(appendReferralParams('https://x.com/p', params));
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

	it('isValidUrl accepts urls with or without protocol', () => {
		expect(isValidUrl('https://example.com')).toBe(true);
		expect(isValidUrl('example.com/path')).toBe(true);
	});

	it('isValidUrl rejects plain text', () => {
		expect(isValidUrl('just text')).toBe(false);
	});
});

describe('hasArrayValue', () => {
	it('distinguishes non-empty arrays', () => {
		expect(hasArrayValue([1])).toBe(true);
		expect(hasArrayValue([])).toBe(false);
		expect(hasArrayValue(null)).toBe(false);
	});
});
