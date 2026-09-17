import { vercelStegaCombine } from '@vercel/stega';
import { describe, expect, it } from 'vitest';
import { badgeLabel, sortBadges } from './product-badges';

const LABELS = {
	new: 'New',
	'founders-pick': "Founder's Pick",
};

describe('sortBadges', () => {
	// Literals, not `PRODUCT_BADGE_OPTIONS`: asserting against the array the
	// rank is derived from would pass for any ranking, including a wrong one.
	it('orders by priority regardless of the stored tick order', () => {
		expect(
			sortBadges(['editors-choice', 'most-popular', 'founders-pick', 'new'])
		).toEqual(['new', 'founders-pick', 'most-popular', 'editors-choice']);
	});

	it('sorts unrecognized values last, keeping their relative order', () => {
		expect(sortBadges(['zeta', 'alpha', 'new'])).toEqual([
			'new',
			'zeta',
			'alpha',
		]);
	});

	it('drops duplicates, which would collide as React keys', () => {
		expect(sortBadges(['new', 'founders-pick', 'new'])).toEqual([
			'new',
			'founders-pick',
		]);
	});

	it('returns an empty array for empty, null and undefined input', () => {
		expect(sortBadges([])).toEqual([]);
		expect(sortBadges(null)).toEqual([]);
		expect(sortBadges(undefined)).toEqual([]);
	});

	it('does not mutate its input', () => {
		const input = ['editors-choice', 'new'];
		sortBadges(input);
		expect(input).toEqual(['editors-choice', 'new']);
	});

	// Pins the dependency rather than a capability: this module deliberately
	// does NOT clean stega, because `@sanity/client/stega` is not a leaf and
	// `p-product.ts` imports this file into the Studio bundle. The opt-out in
	// `sanity/lib/client.ts` is what keeps encoded tokens from ever arriving —
	// and this is what that costs if it stops firing. Draft mode only.
	it('ranks an encoded token as unknown, so the client filter is load-bearing', () => {
		const encoded = vercelStegaCombine('new', { origin: 'sanity.io' });
		expect(sortBadges([encoded, 'editors-choice'])).toEqual([
			'editors-choice',
			encoded,
		]);
	});
});

describe('badgeLabel', () => {
	it('resolves a known token to its label', () => {
		expect(badgeLabel('new', LABELS)).toBe('New');
	});

	it('falls back to the raw token when the dictionary has no entry', () => {
		expect(badgeLabel('limited', LABELS)).toBe('limited');
	});

	// `options.list` is a Studio affordance, not a Content Lake constraint, so a
	// token is an arbitrary string. A plain index would resolve these up the
	// prototype chain and hand React a function or an object to render.
	it.each([
		'__proto__',
		'constructor',
		'toString',
		'valueOf',
		'hasOwnProperty',
	])(
		'falls back for the inherited key %s rather than returning a non-string',
		(key) => {
			const label = badgeLabel(key, LABELS);
			expect(typeof label).toBe('string');
			expect(label).toBe(key);
		}
	);
});
