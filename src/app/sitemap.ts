import { MetadataRoute } from 'next';
import { client } from '@/sanity/lib/client';
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

type SitemapDoc = {
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
};

/** Locales a row represents, whichever i18n model its type uses. */
function docLocales(doc: SitemapDoc): Locale[] {
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

const QUERIES: Record<string, string> = {
	pages: SITEMAP_PAGES_QUERY,
	events: SITEMAP_EVENTS_QUERY,
	products: SITEMAP_PRODUCTS_QUERY,
};

// Tags per sitemap, so a publish invalidates the sitemap that lists that type.
// Without a cache config `client.fetch` defaults to no-store, which made all
// three sitemaps hit Sanity on every crawler request, outside the tag scheme.
const SITEMAP_TAGS: Record<string, string[]> = {
	pages: ['pHome', 'pGeneral', 'pContact', 'pFaq', 'pSizeGuide'],
	events: ['pEvents', 'pEvent'],
	products: [
		'pProductIndex',
		'pProduct',
		'pProductCategory',
		'pProductCollection',
	],
};

export async function generateSitemaps() {
	return [{ id: 'pages' }, { id: 'events' }, { id: 'products' }];
}

export default async function sitemap({
	id,
}: {
	id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
	const resolvedId = await id;
	const query = QUERIES[resolvedId];
	if (!query) return [];

	try {
		const docs =
			(await client
				// useCdn: false because this read is tag-cached under revalidate:false.
				// Through the CDN, the re-fetch a tag invalidation triggers can return
				// data up to ~60s stale and then persist until the next invalidation —
				// the case src/sanity/lib/client.ts's own comment warns about.
				.withConfig({ useCdn: false })
				.fetch<SitemapDoc[]>(
					query,
					{},
					{
						next: {
							revalidate: false,
							tags: SITEMAP_TAGS[resolvedId] ?? [],
						},
					}
				)) ?? [];

		// Group documents by their URL identity (type + slug).
		// Each group may contain multiple rows — one per locale.
		const grouped = new Map<string, SitemapDoc[]>();
		for (const doc of docs) {
			const key = `${doc._type}:${doc.slug ?? ''}`;
			const list = grouped.get(key) ?? [];
			list.push(doc);
			grouped.set(key, list);
		}

		const entries: MetadataRoute.Sitemap = [];

		for (const group of grouped.values()) {
			const { _type, slug } = group[0];

			// Determine which locales this group's page exists in — one row per
			// locale for document-level types, one row carrying all locales for
			// field-level ones.
			const availableLocales: Locale[] = [
				...new Set(group.flatMap(docLocales)),
			];

			// Build reusable hreflang map for all entries in this group
			const languages: Record<string, string> = {};
			for (const l of availableLocales) {
				const href = resolveHref({ documentType: _type, slug, locale: l });
				if (href)
					languages[htmlLangFor(l)] = new URL(
						href,
						process.env.SITE_URL
					).toString();
			}
			// x-default only when the default locale actually renders this page.
			// Emitted unconditionally, a zh-only product advertised its English URL
			// as the default — and that URL is a not-found page.
			if (availableLocales.includes(DEFAULT_LOCALE)) {
				const defaultHref = resolveHref({
					documentType: _type,
					slug,
					locale: DEFAULT_LOCALE,
				});
				if (defaultHref)
					languages['x-default'] = new URL(
						defaultHref,
						process.env.SITE_URL
					).toString();
			}

			// Emit one sitemap entry per available locale
			for (const locale of availableLocales) {
				const href = resolveHref({ documentType: _type, slug, locale });
				if (!href) continue;

				const row =
					group.find((d) => docLocales(d).includes(locale)) ?? group[0];

				entries.push({
					url: new URL(href, process.env.SITE_URL).toString(),
					lastModified: new Date(row._updatedAt),
					changeFrequency: 'weekly' as const,
					priority: 0.8,
					alternates: { languages },
				});
			}
		}

		return entries;
	} catch (error) {
		console.error(`Failed to generate sitemap "${resolvedId}":`, error);
		return [];
	}
}
