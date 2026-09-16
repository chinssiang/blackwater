import { Layout } from '@/components/layout';
import { getCachedSiteData, pickLayoutData } from '@/sanity/lib/siteData';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

// The site chrome (Header, Newsletter, Footer, ToolBar). Lives in a route group
// so that [locale]/not-found.tsx — which sits outside (site) — renders without
// this chrome. getCachedSiteData is React-cached, so this fetch dedupes with the
// one in [locale]/layout.tsx.
export default async function SiteLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	// Narrowed rather than cast: the segment is a URL string, and the tag
	// `locale:<locale>` it keys is now type-checked, so an unrecognised value
	// must resolve to a real locale instead of minting a bogus cache tag.
	const { data } = await getCachedSiteData(
		isLocale(locale) ? locale : DEFAULT_LOCALE
	);
	return <Layout siteData={pickLayoutData(data)}>{children}</Layout>;
}
