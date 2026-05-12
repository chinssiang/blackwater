import { MetadataRoute } from 'next';
import { client } from '@/sanity/lib/client';
import {
	SITEMAP_PAGES_QUERY,
	SITEMAP_EVENTS_QUERY,
	SITEMAP_CURATED_QUERY,
} from '@/sanity/lib/queries';
import { resolveHref } from '@/lib/routes';

type SitemapDoc = { _type: string; slug: string | null; _updatedAt: string };

const QUERIES: Record<string, string> = {
	pages: SITEMAP_PAGES_QUERY,
	events: SITEMAP_EVENTS_QUERY,
	curated: SITEMAP_CURATED_QUERY,
};

export async function generateSitemaps() {
	return [{ id: 'pages' }, { id: 'events' }, { id: 'curated' }];
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
		return docs
			.map((doc) => {
				const href = resolveHref({ documentType: doc._type, slug: doc.slug });
				if (!href) return null;
				return {
					url: new URL(href, process.env.SITE_URL).toString(),
					lastModified: new Date(doc._updatedAt),
					changeFrequency: 'weekly' as const,
					priority: 0.8,
				};
			})
			.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
	} catch (error) {
		console.error(`Failed to generate sitemap "${resolvedId}":`, error);
		return [];
	}
}
