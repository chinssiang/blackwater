import { Layout } from '@/components/layout';
import { getCachedSiteData } from '@/sanity/lib/siteData';

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
	const { data } = await getCachedSiteData(locale);
	return <Layout siteData={data}>{children}</Layout>;
}
