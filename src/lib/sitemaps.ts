import type { MetadataRoute } from 'next';
import {
	SITEMAP_PAGES_QUERY,
	SITEMAP_EVENTS_QUERY,
	SITEMAP_PRODUCTS_QUERY,
} from '@/sanity/lib/queries';
import { resolveHref } from '@/lib/routes';
import {
	type Locale,
	DEFAULT_LOCALE,
	htmlLangFor,
	isLocale,
} from '@/lib/i18n';

// Sitemap configuration, and the pure helpers that turn it into entries.
//
// Split out of app/sitemap.ts, which builds a Sanity client at module load:
// everything that does not need the network lives here so the unit tests can
// import it, per the "pure modules under src/lib" rule vitest.config.ts states.
// app/sitemap.ts keeps only the fetch and the grouping.

// The sitemap ids. Typing the maps below as Record<SitemapId, …> makes "added a
// sitemap, forgot a query" a compile error, and app/sitemap_index.xml/route.ts
// advertises this same list — before it was shared, a missed entry there meant
// either a sitemap nothing linked to or an advertised URL that 404s.
export const SITEMAP_IDS = ['pages', 'events', 'products'] as const;

export type SitemapId = (typeof SITEMAP_IDS)[number];

export function isSitemapId(id: string): id is SitemapId {
	return (SITEMAP_IDS as readonly string[]).includes(id);
}

export const QUERIES: Record<SitemapId, string> = {
	pages: SITEMAP_PAGES_QUERY,
	events: SITEMAP_EVENTS_QUERY,
	products: SITEMAP_PRODUCTS_QUERY,
};

// Tags per sitemap, so a publish invalidates the sitemap that lists that type.
// Without a cache config `client.fetch` defaults to no-store, which made all
// three sitemaps hit Sanity on every crawler request, outside the tag scheme.
//
// Each list must also name every type its query's `contentUpdatedAt` walks
// into, not just the page types the sitemap lists: app/sitemap.ts fetches with
// `revalidate: false` and the webhook only revalidates the changed document's
// own _type, so an untagged referenced type would leave the sitemap — and the
// lastmod computed from it — frozen at whatever it was.
export const SITEMAP_TAGS: Record<SitemapId, string[]> = {
	pages: [
		'pHome',
		'pGeneral',
		'pContact',
		'pFaq',
		'pSizeGuide',
		'pNewsletter',
		'gFaq',
		'gFaqList',
		'gSizeChart',
	],
	events: ['pEvents', 'pEvent', 'gLocation', 'pEventCategory', 'pEventStatus'],
	products: [
		'pProductIndex',
		'pProduct',
		'pProductCategory',
		'pProductCollection',
		'gSizeChart',
		'gTag',
		'pBrand',
	],
};

// Routable pages with no backing Sanity document, so no sitemap query can ever
// emit them however the queries grow — DOCUMENT_ROUTES marks all three
// "synthetic". They render in both locales and serve `index, follow`, so
// leaving them out told Google to index pages it was never shown.
//
// `sitemap` is a field rather than a hardcoded check at the call site, so a
// synthetic route outside the products sitemap needs no new branch. `lists`
// names every type the page renders, which is where its lastmod comes from —
// one entry per rendered type, not per primary type: /products/all shows the
// category filter strip as well as the product grid, and listing only pProduct
// left a category rename invisible to crawlers.
export const SYNTHETIC_ROUTES: ReadonlyArray<{
	documentType: string;
	sitemap: SitemapId;
	lists: readonly string[];
}> = [
	{
		documentType: 'pProductsAllIndex',
		sitemap: 'products',
		lists: ['pProduct', 'pProductCategory'],
	},
	{
		documentType: 'pProductCategoriesIndex',
		sitemap: 'products',
		// pProduct as well: the page shows a total product count and a per-category
		// count, so publishing a product changes what it renders.
		lists: ['pProductCategory', 'pProduct'],
	},
	{
		documentType: 'pProductCollectionsIndex',
		sitemap: 'products',
		lists: ['pProductCollection'],
	},
];

export type SitemapDoc = {
	_type: string;
	slug: string | null;
	_updatedAt: string;
	/** Document-level i18n types: the language of this document row. */
	language?: string;
	/**
	 * Field-level i18n types (the product and event families): every locale this
	 * single document is translated into, derived in GROQ from title[].language.
	 */
	locales?: Array<string | null> | null;
	/**
	 * `_updatedAt` of the documents this page renders but does not own — its FAQ
	 * set and entries, size charts, venue, categories, statuses, brands, tags.
	 * One level of nesting: the GROQ literal holds both scalars and
	 * already-flattened traversal results.
	 */
	contentUpdatedAt?: Array<string | Array<string | null> | null> | null;
};

/** Locales a row represents, whichever i18n model its type uses. */
export function docLocales(doc: SitemapDoc): Locale[] {
	// An array — even an empty one — is the authoritative answer for a
	// field-level type: empty means "translated into nothing", so this document
	// contributes no URLs. Falling through to DEFAULT_LOCALE here published a
	// titleless product as an English URL, defeating the `defined(value)` guard
	// the sitemap query applies for exactly this reason.
	if (Array.isArray(doc.locales)) {
		return doc.locales.filter(isLocale);
	}
	return [isLocale(doc.language) ? doc.language : DEFAULT_LOCALE];
}

/**
 * The newest of the page's own `_updatedAt` and that of the content it pulls in
 * by reference.
 *
 * A document's timestamp only moves when that document is edited, so /faq —
 * whose entire body is `faqSet->questions[]->` — advertised the last time
 * someone touched the pFaq document, however many answers had changed beneath
 * it. Products, events and /size-guide are the same shape. lastmod is what a
 * crawler weighs when deciding whether a recrawl is worthwhile, so a frozen one
 * suppresses exactly the recrawl an edit should provoke.
 *
 * Parsed rather than compared as strings: Sanity omits milliseconds when they
 * are zero, and `"…:12Z" > "…:12.500Z"` lexicographically, which would pick the
 * older stamp.
 */
export function lastModifiedFor(doc: SitemapDoc): Date {
	// Seeded below every real stamp rather than from `_updatedAt` directly: an
	// absent or unparseable document stamp would otherwise poison the result,
	// because NaN loses every `>` comparison and referenced stamps could never
	// win it back.
	let newest = Number.NEGATIVE_INFINITY;
	const consider = (stamp: string | null | undefined) => {
		const parsed = stamp ? Date.parse(stamp) : Number.NaN;
		if (parsed > newest) newest = parsed;
	};

	consider(doc._updatedAt);
	for (const entry of doc.contentUpdatedAt ?? []) {
		// Branch rather than `Array.isArray(entry) ? entry : [entry]`: the scalar
		// arm is the common one, and wrapping it allocated a throwaway array per
		// element on every row of every sitemap.
		if (Array.isArray(entry)) {
			for (const stamp of entry) consider(stamp);
		} else {
			consider(entry);
		}
	}

	// Nothing parsed. `new Date(NaN)` would reach Next's sitemap serializer,
	// which calls toISOString() and throws RangeError — and that happens after
	// the try/catch in app/sitemap.ts has already returned, so the whole sitemap
	// 500s rather than degrading. The epoch is wrong but inert: crawlers read it
	// as "very old".
	return new Date(newest === Number.NEGATIVE_INFINITY ? 0 : newest);
}

/**
 * Newest lastmod among the rows a synthetic route lists, for one locale.
 *
 * Locale-filtered because those pages filter too (`titleVisible` in their
 * queries): without it, editing a zh-only product moved the English
 * /products/all's date although nothing on that page had changed.
 *
 * `dateOf` lets a caller pass dates it has already computed; the default keeps
 * the function usable on its own.
 */
export function newestOf(
	docs: SitemapDoc[],
	types: readonly string[],
	locale: Locale,
	dateOf: (doc: SitemapDoc) => Date = lastModifiedFor
): Date | undefined {
	let newest: number | undefined;
	for (const doc of docs) {
		if (!types.includes(doc._type)) continue;
		if (!docLocales(doc).includes(locale)) continue;
		const time = dateOf(doc).getTime();
		if (newest === undefined || time > newest) newest = time;
	}
	return newest === undefined ? undefined : new Date(newest);
}

const absolute = (href: string) =>
	new URL(href, process.env.SITE_URL).toString();

/**
 * One entry per locale for a single page, all sharing its hreflang map.
 *
 * `lastModified` is resolved per locale because document-level types carry a
 * separate row (and so a separate timestamp) for each one.
 *
 * Deliberately no `changeFrequency` or `priority`: Google ignores both, and
 * every entry here carried the identical 0.8/weekly, so they conveyed nothing
 * even in principle while adding two lines of XML per URL.
 */
export function localizedEntries({
	documentType,
	slug,
	locales,
	lastModified,
}: {
	documentType: string;
	slug: string | null;
	locales: Locale[];
	lastModified: (locale: Locale) => Date | undefined;
}): MetadataRoute.Sitemap {
	// Resolved once and reused by both the hreflang map and the entries, so the
	// two cannot disagree about a URL.
	const urls = new Map<Locale, string>();
	for (const locale of locales) {
		const href = resolveHref({ documentType, slug, locale });
		if (href) urls.set(locale, absolute(href));
	}

	const languages: Record<string, string> = {};
	for (const [locale, url] of urls) languages[htmlLangFor(locale)] = url;
	// x-default only when the default locale actually renders this page — `urls`
	// holds nothing for it otherwise. Emitted unconditionally, a zh-only product
	// advertised its English URL as the default, and that URL is a not-found
	// page.
	const defaultUrl = urls.get(DEFAULT_LOCALE);
	if (defaultUrl) languages['x-default'] = defaultUrl;

	const entries: MetadataRoute.Sitemap = [];
	for (const locale of locales) {
		const url = urls.get(locale);
		if (!url) continue;
		const modified = lastModified(locale);
		entries.push({
			url,
			...(modified && { lastModified: modified }),
			alternates: { languages },
		});
	}
	return entries;
}
