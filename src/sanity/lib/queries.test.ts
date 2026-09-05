import { describe, expect, it } from 'vitest';
import {
	SITEMAP_PAGES_QUERY,
	pageGeneralQuery,
	pageHomeQuery,
} from '@/sanity/lib/queries';

// The visibility predicate is invisible to every other check in the repo.
// Dropping it from a query changes no generated type, breaks no build and
// throws nothing at runtime — the page simply starts rendering sections an
// editor switched off, and the sitemap starts bumping lastmod for them again.
// So it is asserted the way sitemaps.test.ts asserts its own invariants: by
// reading the query TEXT, which is the thing that actually drifts.
//
// `moduleVisible` is not exported, and is spelled out here on purpose. A test
// importing the same constant it is checking would pass no matter what that
// constant said; the literal is the specification.
const MODULE_VISIBLE = 'coalesce(hidden, false) == false';

/** Every `pageModules[...]` filter in a query, as its bracket contents. */
const moduleFilters = (query: string) =>
	[...query.matchAll(/pageModules\[([^\]]*)\]/g)].map((m) => m[1]);

describe('page-module visibility predicate', () => {
	// The two queries that RENDER modules, plus the sitemap projection. A hidden
	// module has to be gone before the array reaches JS: that is what makes
	// PageHome's slot-0 <h1> land on the first module a visitor actually sees and
	// what keeps a hidden faqBlock out of the FAQPage JSON-LD. For the sitemap it
	// is the rule CLAUDE.md states -- the lastmod projection mirrors the render
	// path's conditions -- so an edit behind a switched-off block cannot move a
	// page's lastmod. The counts pin every traversal, not just the first.
	it.each([
		['pageHomeQuery', pageHomeQuery, 1],
		['pageGeneralQuery', pageGeneralQuery, 1],
		['SITEMAP_PAGES_QUERY', SITEMAP_PAGES_QUERY, 3],
	])('%s filters every pageModules traversal', (_name, query, count) => {
		const filters = moduleFilters(query);

		expect(filters).toHaveLength(count);
		for (const filter of filters) {
			expect(filter).toContain(MODULE_VISIBLE);
		}
	});
});
