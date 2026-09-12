import { MetadataRoute } from 'next';
import { client } from '@/sanity/lib/client';
import {
	QUERIES,
	SITEMAP_IDS,
	SITEMAP_TAGS,
	SYNTHETIC_ROUTES,
	docLocales,
	isSitemapId,
	lastModifiedFor,
	localizedEntries,
	newestOf,
	type SitemapDoc,
} from '@/lib/sitemaps';
import { type Locale, LOCALES } from '@/lib/i18n';

export async function generateSitemaps() {
	return SITEMAP_IDS.map((id) => ({ id }));
}

export default async function sitemap({
	id,
}: {
	id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
	const resolvedId = await id;
	if (!isSitemapId(resolvedId)) return [];

	try {
		const docs =
			(await client
				// useCdn: false because this read is tag-cached under revalidate:false.
				// Through the CDN, the re-fetch a tag invalidation triggers can return
				// data up to ~60s stale and then persist until the next invalidation —
				// the case src/sanity/lib/client.ts's own comment warns about.
				.withConfig({ useCdn: false })
				.fetch<SitemapDoc[]>(
					QUERIES[resolvedId],
					{},
					{
						next: {
							revalidate: false,
							tags: SITEMAP_TAGS[resolvedId],
						},
					}
				)) ?? [];

		// One walk of each row's contentUpdatedAt, reused by the grouping loop
		// below and by every synthetic route's newestOf.
		const dates = new Map<SitemapDoc, Date>();
		for (const doc of docs) dates.set(doc, lastModifiedFor(doc));
		const dateOf = (doc: SitemapDoc) => dates.get(doc) ?? lastModifiedFor(doc);

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

			// Which locales this group's page exists in — one row per locale for
			// document-level types, one row carrying all locales for field-level
			// ones.
			const locales: Locale[] = [...new Set(group.flatMap(docLocales))];

			entries.push(
				...localizedEntries({
					documentType: _type,
					slug,
					locales,
					lastModified: (locale) =>
						dateOf(
							group.find((d) => docLocales(d).includes(locale)) ?? group[0]
						),
				})
			);
		}

		for (const route of SYNTHETIC_ROUTES) {
			if (route.sitemap !== resolvedId) continue;
			entries.push(
				...localizedEntries({
					documentType: route.documentType,
					slug: null,
					// Every locale, matching the `availableLocales: [...LOCALES]` these
					// pages hand to defineMetadata — the sitemap and the page's own
					// hreflang must not disagree about where it exists.
					locales: [...LOCALES],
					lastModified: (locale) =>
						newestOf(docs, route.lists, locale, dateOf),
				})
			);
		}

		return entries;
	} catch (error) {
		console.error(`Failed to generate sitemap "${resolvedId}":`, error);
		return [];
	}
}
