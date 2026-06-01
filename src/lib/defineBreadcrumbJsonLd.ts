import { formatUrl } from '@/lib/utils';

// BreadcrumbList JSON-LD. Crumbs are { name, path } where `path` is a
// locale-resolved relative href (from resolveHref). Positions are 1-based.
export type Crumb = { name?: string | null; path?: string | null };

export default function defineBreadcrumbJsonLd(
	crumbs: Crumb[]
): Record<string, unknown> | null {
	const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';
	const items = crumbs.filter((c) => c?.name && c?.path);
	if (items.length < 2) return null;

	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((c, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: c.name,
			item: formatUrl(`${siteUrl}${c.path}`),
		})),
	};
}
