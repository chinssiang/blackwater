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
	language?: string;
};

const QUERIES: Record<string, string> = {
	pages: SITEMAP_PAGES_QUERY,
	events: SITEMAP_EVENTS_QUERY,
	products: SITEMAP_PRODUCTS_QUERY,
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
		const docs = (await client.fetch<SitemapDoc[]>(query)) ?? [];

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

			// Determine which locales have a Sanity document in this group
			const availableLocales: Locale[] = [
				...new Set(
					group.map((d) => (isLocale(d.language) ? d.language : DEFAULT_LOCALE))
				),
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
			const defaultHref = resolveHref({ documentType: _type, slug, locale: DEFAULT_LOCALE });
			if (defaultHref)
				languages['x-default'] = new URL(defaultHref, process.env.SITE_URL).toString();

			// Emit one sitemap entry per available locale
			for (const locale of availableLocales) {
				const href = resolveHref({ documentType: _type, slug, locale });
				if (!href) continue;

				const row =
					group.find((d) =>
						(isLocale(d.language) ? d.language : DEFAULT_LOCALE) === locale
					) ?? group[0];

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
