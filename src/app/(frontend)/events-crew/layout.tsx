import { Layout } from '@/components/layout';
import { getCachedSiteData } from '@/sanity/lib/siteData';
import { DEFAULT_LOCALE } from '@/lib/i18n';

export default async function EventsCrewLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data } = await getCachedSiteData(DEFAULT_LOCALE);
	return <Layout siteData={data}>{children}</Layout>;
}
