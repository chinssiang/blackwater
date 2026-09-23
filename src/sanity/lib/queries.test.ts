import {
	SITEMAP_PAGES_QUERY,
	pageGeneralQuery,
	pageHomeQuery,
} from '@/sanity/lib/queries';
import { portableTextSimple } from '@/sanity/schemaTypes/objects/portable-text-simple';
import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

// The two Studio inputs the schema module imports; the guard below needs only
// the definition's shape, and a stub keeps @sanity/ui out of the node run.
vi.mock('@/sanity/schemaTypes/components/PortableTextNormalizer', () => ({
	PortableTextNormalizer: () => null,
}));
vi.mock('@/sanity/schemaTypes/components/LinkObject', () => ({
	LinkObject: () => null,
}));

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

// `portableTextSimpleFields` projects only the arms the `portableTextSimple`
// schema type can produce. Nothing else ties the two: add an annotation (say a
// callToAction, copied from `portableText`) or a member such as `customImage()`
// to the schema, and the hero and editorial paragraphs would receive it
// unprojected -- a raw language array, an unresolved reference -- while typegen
// stays green. It reads the real definition, not the file's text, so a member
// written as a factory call or inline cannot slip past.
describe('portableTextSimpleFields', () => {
	it('has an arm for every annotation and member type of portableTextSimple', async () => {
		const queries = await readFile(
			new URL('./queries.ts', import.meta.url),
			'utf8'
		);
		const fragment = queries.match(
			/const portableTextSimpleFields = `([\s\S]*?)` as const;/
		)?.[1];
		expect(fragment).toBeDefined();

		type Member = {
			name?: string;
			type: string;
			marks?: { annotations?: { name?: string; type?: string }[] };
		};
		const members = portableTextSimple.of as Member[];
		// An array member's `_type` is its name when it has one (every factory
		// sets one), its type otherwise. `block` is the member every fragment
		// already spreads.
		const memberTypes = members
			.map((member) => member.name ?? member.type)
			.filter((type) => type !== 'block');
		const annotationTypes = members.flatMap((member) =>
			(member.marks?.annotations ?? []).map(
				(annotation) => annotation.name ?? annotation.type
			)
		);

		expect(annotationTypes).toContain('link');
		for (const type of [...annotationTypes, ...memberTypes]) {
			expect(fragment).toContain(`_type == "${type}"`);
		}
	});
});
