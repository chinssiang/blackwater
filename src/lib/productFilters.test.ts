import en from '@/dictionaries/en.json';
import zh from '@/dictionaries/zh_tw.json';
import {
	pageProductsAllQuery,
	productFilterFacetsQuery,
} from '@/sanity/lib/queries';
import { describe, expect, it } from 'vitest';
import { PRODUCT_BADGE_OPTIONS } from '@/lib/product-badges';
import {
	DEFAULT_PRODUCT_SORT,
	PRICE_BUCKETS,
	PRODUCT_SORT_KEYS,
	countActiveFilters,
	isProductFilterActive,
	parseProductFilters,
} from '@/lib/productFilters';

// The filter UI, the GROQ that answers it and the labels that name it are three
// files that have to agree, and nothing else makes them. Each of these guards a
// drift that fails silently: a sort the menu offers and the parser rejects, a
// price bucket whose GROQ boundary no longer matches its label.

describe('price buckets', () => {
	// The thresholds exist twice on purpose -- once here, once in the GROQ
	// select() -- because Sanity's typegen cannot evaluate computed
	// interpolation. Twice, not four times: the facet counts go through the same
	// select() rather than restating the boundaries as their own range pairs.
	it('spells every bucket boundary into the GROQ select()', () => {
		for (const bucket of PRICE_BUCKETS) {
			if (bucket.max == null) {
				// The final bucket is the select()'s fallback arm, so it appears as a
				// bare value with no comparison.
				expect(productFilterFacetsQuery).toContain(`\t"${bucket.key}"\n`);
				continue;
			}
			expect(productFilterFacetsQuery).toContain(
				`priceAmount < ${bucket.max} => "${bucket.key}"`
			);
		}
	});

	it('states the boundaries nowhere else in the queries', () => {
		// A hand-written `priceAmount >= 1000 && priceAmount < 3000` facet is the
		// third copy this replaced. Every price comparison now lives in the
		// select() above, which only ever uses `<`.
		for (const query of [pageProductsAllQuery, productFilterFacetsQuery]) {
			expect(query).not.toContain('priceAmount >');
		}
	});

	it('is labelled in every locale', () => {
		for (const dict of [en, zh]) {
			const labels = dict.products.filters.priceBuckets as Record<
				string,
				string
			>;
			expect(Object.keys(labels).sort()).toEqual(
				PRICE_BUCKETS.map((b) => b.key as string).sort()
			);
		}
	});

	it('covers the number line with no gap and no overlap', () => {
		let previous = 0;
		for (const bucket of PRICE_BUCKETS) {
			expect(bucket.min).toBe(previous);
			previous = bucket.max ?? Infinity;
		}
		expect(previous).toBe(Infinity);
	});
});

describe('sort keys', () => {
	// ProductFilters renders the menu straight off PRODUCT_SORT_KEYS, so the two
	// cannot drift -- but the labels and the GROQ arms still can.
	it('is labelled in every locale', () => {
		for (const dict of [en, zh]) {
			const labels = dict.products.filters.sortOptions as Record<
				string,
				string
			>;
			expect(Object.keys(labels).sort()).toEqual([...PRODUCT_SORT_KEYS].sort());
		}
	});

	it('has a GROQ order arm for every non-default key', () => {
		// 'az' is the trailing default, so it has no `$sort ==` arm of its own.
		for (const key of PRODUCT_SORT_KEYS) {
			if (key === 'az') continue;
			expect(pageProductsAllQuery).toContain(`$sort == "${key}"`);
		}
	});
});

describe('parseProductFilters', () => {
	it('splits, trims and drops empties', () => {
		expect(
			parseProductFilters({ category: ' tops , bottoms ,, ' }).categories
		).toEqual(['tops', 'bottoms']);
	});

	it('defaults to an empty selection and the az sort', () => {
		expect(parseProductFilters({})).toEqual({
			categories: [],
			brands: [],
			badges: [],
			priceBuckets: [],
			sort: 'az',
		});
	});

	it('dedupes repeated values', () => {
		// Same GROQ match either way, but a different cache key and a duplicated
		// chip in the toolbar.
		expect(
			parseProductFilters({ brand: 'norda,norda,satisfy' }).brands
		).toEqual(['norda', 'satisfy']);
	});

	it('caps a crafted list rather than passing it through', () => {
		const crafted = Array.from({ length: 500 }, (_, i) => `b${i}`).join(',');
		expect(parseProductFilters({ brand: crafted }).brands).toHaveLength(50);
	});

	it('drops unrecognized price buckets', () => {
		expect(
			parseProductFilters({ price: 'u1000,not-a-bucket' }).priceBuckets
		).toEqual(['u1000']);
	});

	it('falls back to az for an unknown sort', () => {
		expect(parseProductFilters({ sort: 'cheapest' }).sort).toBe('az');
		expect(parseProductFilters({ sort: 'price-desc' }).sort).toBe('price-desc');
	});
});

describe('badge facets', () => {
	// The badge tokens reach GROQ as literals -- typegen cannot evaluate a
	// computed key -- so the query is a second listing of a vocabulary
	// product-badges.ts exists to own. The UI list is derived from that module,
	// which leaves this pair as the one place the two can still drift.
	it('counts every badge in PRODUCT_BADGE_OPTIONS', () => {
		for (const { value } of PRODUCT_BADGE_OPTIONS) {
			expect(productFilterFacetsQuery).toContain(`"${value}": {`);
			expect(productFilterFacetsQuery).toContain(`"${value}" in badge`);
		}
	});

	it('counts nothing that is not a badge', () => {
		const counted = [
			...productFilterFacetsQuery.matchAll(/"([a-z-]+)" in badge/g),
		].map((m) => m[1]);
		expect([...new Set(counted)].sort()).toEqual(
			PRODUCT_BADGE_OPTIONS.map((o) => o.value as string).sort()
		);
	});
});

describe('filter predicates', () => {
	const none = parseProductFilters({});

	it('counts values across all four dimensions', () => {
		expect(countActiveFilters(none)).toBe(0);
		expect(
			countActiveFilters(
				parseProductFilters({ category: 'tops,bottoms', price: 'u1000' })
			)
		).toBe(3);
	});

	it('treats a non-default sort as filtered but not as a filter value', () => {
		// The de-index rule needs sort to count (the URL is not canonical); the
		// "no results, clear your filters" recovery must not (there is nothing to
		// clear), which is why these are two functions.
		const sorted = parseProductFilters({ sort: 'newest' });
		expect(countActiveFilters(sorted)).toBe(0);
		expect(isProductFilterActive(sorted)).toBe(true);
	});

	it('is inactive for the bare listing', () => {
		expect(isProductFilterActive(none)).toBe(false);
		expect(
			isProductFilterActive(parseProductFilters({ sort: DEFAULT_PRODUCT_SORT }))
		).toBe(false);
	});
});
