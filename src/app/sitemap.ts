import { MetadataRoute } from 'next';
import { client } from '@/sanity/lib/client';
import { SITEMAP_QUERY } from '@/sanity/lib/queries';
import { resolveHref } from '@/lib/routes';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	try {
		const paths = await client.fetch(SITEMAP_QUERY);

		if (!paths) return [];

		return paths.map((path: any) => ({
			url: new URL(
				resolveHref({ documentType: path._type, slug: path.slug })!,
				process.env.SITE_URL
			).toString(),
			lastModified: new Date(path._updatedAt),
			// changeFrequency: 'weekly',
			priority: 0.8,
		}));
	} catch (error) {
		console.error('Failed to generate sitemap:', error);
		return [];
	}
}
