import { describe, expect, it } from 'vitest';
import {
	QUERIES,
	SITEMAP_IDS,
	SITEMAP_TAGS,
	SYNTHETIC_ROUTES,
	lastModifiedFor,
	localizedEntries,
	newestOf,
	type SitemapDoc,
	type SitemapId,
} from '@/lib/sitemaps';
import { LOCALES } from '@/lib/i18n';
import {
	pageProductsAllQuery,
	pageProductCategoriesIndexQuery,
	pageProductCollectionsIndexQuery,
} from '@/sanity/lib/queries';

// localizedEntries builds absolute URLs from SITE_URL; without one `new URL`
// throws. Set before the suites run so the value is present at call time.
process.env.SITE_URL = 'https://example.test';
import { DOCUMENT_ROUTES } from '@/lib/routes';

// lastModifiedFor decides what crawlers see as lastmod, and every one of its
// rules is invisible at the call site: the shape it unwraps comes from GROQ,
// and getting one wrong degrades silently into a date that is merely plausible.
describe('lastModifiedFor', () => {
	it('uses the document stamp when nothing is referenced', () => {
		expect(
			lastModifiedFor({
				_type: 'pGeneral',
				slug: 'terms',
				_updatedAt: '2026-08-29T12:25:45Z',
			}).toISOString()
		).toBe('2026-08-29T12:25:45.000Z');
	});

	it('prefers a newer referenced stamp over the document stamp', () => {
		expect(
			lastModifiedFor({
				_type: 'pFaq',
				slug: 'faq',
				_updatedAt: '2026-01-01T00:00:00Z',
				contentUpdatedAt: ['2026-06-06T06:06:06Z'],
			}).toISOString()
		).toBe('2026-06-06T06:06:06.000Z');
	});

	it('keeps the document stamp when every reference is older', () => {
		expect(
			lastModifiedFor({
				_type: 'pFaq',
				slug: 'faq',
				_updatedAt: '2026-08-29T12:02:12Z',
				contentUpdatedAt: ['2026-08-29T08:20:01Z'],
			}).toISOString()
		).toBe('2026-08-29T12:02:12.000Z');
	});

	// GROQ array traversals arrive as a flat array nested one level inside the
	// projection's own literal; scalars and nulls share that literal.
	it('unwraps one level of nesting and ignores nulls', () => {
		expect(
			lastModifiedFor({
				_type: 'pProduct',
				slug: 'x',
				_updatedAt: '2026-01-01T00:00:00Z',
				contentUpdatedAt: [
					null,
					'2026-02-02T00:00:00Z',
					[null, '2026-07-07T07:07:07Z', null],
					[],
				],
			}).toISOString()
		).toBe('2026-07-07T07:07:07.000Z');
	});

	// Sanity omits milliseconds when they are zero, and "…:12Z" sorts AFTER
	// "…:12.500Z" lexicographically — a string compare would pick the older one.
	it('compares instants, not strings, across mixed millisecond precision', () => {
		expect(
			lastModifiedFor({
				_type: 'pFaq',
				slug: 'faq',
				_updatedAt: '2026-08-29T12:02:12Z',
				contentUpdatedAt: ['2026-08-29T12:02:12.500Z'],
			}).toISOString()
		).toBe('2026-08-29T12:02:12.500Z');
	});

	// An Invalid Date reaches Next's serializer, which calls toISOString() and
	// throws RangeError outside sitemap()'s try/catch, 500-ing the whole route.
	it('never returns an Invalid Date', () => {
		const allBad = lastModifiedFor({
			_type: 'pGeneral',
			slug: 'x',
			_updatedAt: 'not-a-date',
			contentUpdatedAt: [null, ['also-not-a-date']],
		});
		expect(Number.isNaN(allBad.getTime())).toBe(false);
		expect(() => allBad.toISOString()).not.toThrow();
	});

	it('recovers a valid referenced stamp when the document stamp is unparseable', () => {
		expect(
			lastModifiedFor({
				_type: 'pFaq',
				slug: 'faq',
				_updatedAt: '',
				contentUpdatedAt: [['2026-03-03T03:03:03Z']],
			}).toISOString()
		).toBe('2026-03-03T03:03:03.000Z');
	});
});

// The sitemaps are fetched with `revalidate: false` and the Sanity webhook only
// revalidates the changed document's own _type. So a type that contentUpdatedAt
// dereferences but SITEMAP_TAGS omits leaves the sitemap — and the lastmod
// computed from it — frozen forever, with nothing failing anywhere. This makes
// that coupling mechanical.
// GROQ field name → the document type it dereferences to. Hand-written because
// the field name alone does not name its type; an unlisted field fails the test
// below rather than passing silently.
const DEREF_FIELD_TYPES: Record<string, string> = {
	faqSet: 'gFaqList',
	questions: 'gFaq',
	chart: 'gSizeChart',
	sizeChart: 'gSizeChart',
	locationRef: 'gLocation',
	eventStatus: 'pEventStatus',
	brands: 'pBrand',
};

// Per-sitemap, because `categories` means a different type in each.
const DEREF_FIELD_TYPES_BY_ID: Record<SitemapId, Record<string, string>> = {
	pages: {},
	events: { categories: 'pEventCategory' },
	products: {
		categories: 'pProductCategory',
		collections: 'pProductCollection',
		// whenReachForIt.list[] and metadata[].list[] hold gTag references.
		list: 'gTag',
	},
};

/** Every `field->` occurrence in a query's contentUpdatedAt projection. */
function derefFields(query: string): string[] {
	// Closing bracket matched at any indentation: anchoring on the current two
	// tabs meant a reformat of queries.ts emptied this list, and the suite then
	// failed claiming the query had no derefs rather than that the test could
	// not find them.
	const projection = query.match(/"contentUpdatedAt":\s*\[([\s\S]*?)^\s*\]/m)?.[1];
	expect(projection, 'contentUpdatedAt projection not found — regex stale?').toBeDefined();
	if (!projection) return [];
	return [
		...new Set(
			[...projection.matchAll(/([A-Za-z_][\w]*)\s*(?:\[[^\]]*\])?->/g)].map(
				(m) => m[1]
			)
		),
	];
}

describe.each(SITEMAP_IDS)('%s sitemap tag coverage', (id) => {
	const fields = derefFields(QUERIES[id]);

	it('dereferences at least one type', () => {
		expect(fields.length).toBeGreaterThan(0);
	});

	it.each(fields)('tags the type behind %s->', (field) => {
		const type = DEREF_FIELD_TYPES_BY_ID[id][field] ?? DEREF_FIELD_TYPES[field];
		// An unmapped field is the failure that matters: it means a deref was
		// added without deciding which tag keeps this sitemap fresh.
		expect(type, `no type mapped for "${field}->"`).toBeDefined();
		expect(SITEMAP_TAGS[id]).toContain(type);
	});
});

// Every routable page must reach a sitemap. /newsletter shipped indexable but
// unlisted for exactly this reason: pNewsletter was routable and had a
// document, and nobody added it to the query's type list. The three synthetic
// /products/* indexes had the same symptom from the opposite cause — no
// document for a query to find — so both routes into the bug are covered here.
describe('sitemap route coverage', () => {
	const queried = new Set(
		// matchAll, not match: a second `_type in [...]` anywhere in a query would
		// otherwise be invisible, and a type listed only there would be reported
		// as uncovered when it is not.
		Object.values(QUERIES).flatMap((query) =>
			[...query.matchAll(/_type in \[([^\]]*)\]/g)].flatMap((clause) =>
				[...clause[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
			)
		)
	);
	const synthetic = new Set<string>(
		SYNTHETIC_ROUTES.map((r) => r.documentType)
	);

	it.each(DOCUMENT_ROUTES.map((r) => r.type))(
		'%s is emitted by a sitemap',
		(type) => {
			expect(
				queried.has(type) || synthetic.has(type),
				`${type} is routable but no sitemap emits it`
			).toBe(true);
		}
	);

	it('claims no type that is not routable', () => {
		const routable = new Set(DOCUMENT_ROUTES.map((r) => r.type));
		for (const type of [...queried, ...synthetic]) {
			expect(routable, `${type} is in a sitemap but has no route`).toContain(
				type
			);
		}
	});
});

// The synthetic /products/* routes are the only entries not derived from a
// document, and they produced 6 of the 7 URLs this change added. Nothing else
// pins their shape.
describe('synthetic route entries', () => {
	const row = (
		_type: string,
		_updatedAt: string,
		locales?: Array<string | null>
	): SitemapDoc => ({ _type, slug: null, _updatedAt, locales });

	const docs = [
		row('pProduct', '2026-01-01T00:00:00Z', ['en', 'zh_tw']),
		row('pProduct', '2026-05-05T00:00:00Z', ['zh_tw']),
		row('pProductCategory', '2026-03-03T00:00:00Z', ['en', 'zh_tw']),
	];

	it('takes the newest among every type the page lists', () => {
		// pProductCategory alone would give March; the category strip and the
		// product grid are both rendered, so en must see the newer of the two.
		expect(
			newestOf(docs, ['pProduct', 'pProductCategory'], 'en')?.toISOString()
		).toBe('2026-03-03T00:00:00.000Z');
	});

	it('ignores rows the locale does not render', () => {
		// The May product is zh-only, so it must not move the English date...
		expect(newestOf(docs, ['pProduct'], 'en')?.toISOString()).toBe(
			'2026-01-01T00:00:00.000Z'
		);
		// ...but it is the newest thing zh_tw shows.
		expect(newestOf(docs, ['pProduct'], 'zh_tw')?.toISOString()).toBe(
			'2026-05-05T00:00:00.000Z'
		);
	});

	it('has no date when the locale renders nothing of that type', () => {
		expect(newestOf([], ['pProduct'], 'en')).toBeUndefined();
	});

	it('emits one entry per locale, cross-linked, with x-default', () => {
		const entries = localizedEntries({
			documentType: 'pProductCategoriesIndex',
			slug: null,
			locales: [...LOCALES],
			lastModified: () => new Date('2026-03-03T00:00:00Z'),
		});

		expect(entries.map((e) => e.url)).toEqual([
			'https://example.test/products/categories',
			'https://example.test/zh_tw/products/categories',
		]);
		// Both entries advertise the same full alternate set, x-default included.
		for (const entry of entries) {
			expect(entry.alternates?.languages).toEqual({
				en: 'https://example.test/products/categories',
				'zh-TW': 'https://example.test/zh_tw/products/categories',
				'x-default': 'https://example.test/products/categories',
			});
			expect(entry.lastModified).toEqual(new Date('2026-03-03T00:00:00Z'));
		}
	});

	it('omits lastModified rather than emitting an invalid one', () => {
		const [entry] = localizedEntries({
			documentType: 'pProductsAllIndex',
			slug: null,
			locales: [...LOCALES],
			lastModified: () => undefined,
		});
		expect(entry.url).toBe('https://example.test/products/all');
		expect('lastModified' in entry).toBe(false);
	});

	it('routes every synthetic entry to a sitemap that exists', () => {
		for (const route of SYNTHETIC_ROUTES) {
			expect(SITEMAP_IDS).toContain(route.sitemap);
			expect(route.lists.length).toBeGreaterThan(0);
		}
	});
});

// A synthetic route's `lists` is its whole lastmod input, and nothing about the
// page it stands for forces the two to agree — /products/all listed only
// pProduct while also rendering the category filter strip, so a category rename
// left its date frozen. Read the types straight out of the page's own query.
const PAGE_QUERY: Record<string, string> = {
	pProductsAllIndex: pageProductsAllQuery,
	pProductCategoriesIndex: pageProductCategoriesIndexQuery,
	pProductCollectionsIndex: pageProductCollectionsIndexQuery,
};

describe.each(SYNTHETIC_ROUTES)(
	'$documentType lists what its page queries',
	(route) => {
		it('covers every tracked type the page selects', () => {
			const query = PAGE_QUERY[route.documentType];
			expect(query, `no page query mapped for ${route.documentType}`).toBeDefined();

			// Only types this sitemap already tracks: a page query also reads
			// settingsGeneral for share defaults, which is not listed content and
			// has no business moving a lastmod.
			const tracked = new Set(SITEMAP_TAGS[route.sitemap]);
			// Anchored on `*[` so this reads document SELECTIONS only. A bare
			// `_type == "x"` also appears in resolvedHrefGroq's select() arms,
			// which branch on the current document to build a link and select
			// nothing.
			const selected = [
				...new Set(
					[...query.matchAll(/\*\[\s*_type\s*==\s*"([^"]+)"/g)].map(
						(m) => m[1]
					)
				),
			].filter((type) => tracked.has(type));

			expect(selected.length).toBeGreaterThan(0);
			for (const type of selected) {
				expect(
					route.lists,
					`${route.documentType} renders ${type} but does not list it`
				).toContain(type);
			}
		});
	}
);
