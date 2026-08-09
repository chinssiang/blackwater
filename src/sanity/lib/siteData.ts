import { cache } from 'react';
import { sanityFetch } from '@/sanity/lib/live';
import { siteDataQuery } from '@/sanity/lib/queries';

export const SITE_DATA_TAGS = [
	'gAnnouncement',
	'gHeader',
	'gFooter',
	'gMobileMenu',
	'gNewsletter',
	'gToolbar',
	'settingsMenu',
	'settingsGeneral',
	'settingsIntegration',
	'settingsConsent',
	'settingsCart',
	'settingsBrandColors',
	'pProductIndex',
] as const;

// Deliberately Sanity-only. This runs for every page that renders the site
// chrome — including generateMetadata, /email-signature, /events-crew and the
// 404 — so nothing here may depend on Shopify: `revalidateTag('shopify')` fires
// on every product and inventory webhook, and a Storefront lookup in this path
// would make the next render of an unrelated page block on it.
export const getCachedSiteData = cache((locale: string) =>
	sanityFetch({
		query: siteDataQuery,
		params: { locale },
		tags: [...SITE_DATA_TAGS, `locale:${locale}`],
	})
);
