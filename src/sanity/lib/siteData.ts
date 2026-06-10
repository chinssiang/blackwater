import { cache } from 'react';
import { sanityFetch } from '@/sanity/lib/live';
import { siteDataQuery } from '@/sanity/lib/queries';

export const SITE_DATA_TAGS = [
	'gAnnouncement',
	'gHeader',
	'gFooter',
	'gMobileMenu',
	'gToolbar',
	'settingsMenu',
	'settingsGeneral',
	'settingsIntegration',
	'settingsBrandColors',
	'pProductIndex',
] as const;

export const getCachedSiteData = cache((locale: string) =>
	sanityFetch({
		query: siteDataQuery,
		params: { locale },
		tags: [...SITE_DATA_TAGS, `locale:${locale}`],
	})
);
