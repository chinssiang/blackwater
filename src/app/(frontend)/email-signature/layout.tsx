import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { stegaClean } from '@sanity/client/stega';
import { LocaleProvider } from '@/components/LocaleProvider';
import { Layout } from '@/components/layout';
import HtmlShell from '@/components/layout/HtmlShell';
import { getCachedSiteData } from '@/sanity/lib/siteData';
import { getDictionary } from '@/lib/dictionary.server';
import { buildBaseMetadata } from '@/lib/defineBaseMetadata';
import { DEFAULT_LOCALE } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
	const { data } = await getCachedSiteData(DEFAULT_LOCALE);
	const cleanData = stegaClean(data) as { sharing?: unknown } | undefined;
	return buildBaseMetadata(DEFAULT_LOCALE, cleanData?.sharing as never);
}

export default async function EmailSignatureLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { isEnabled: isDraftModeEnabled } = await draftMode();
	const [{ data }, dictionary] = await Promise.all([
		getCachedSiteData(DEFAULT_LOCALE),
		getDictionary(DEFAULT_LOCALE),
	]);
	return (
		<HtmlShell
			locale={DEFAULT_LOCALE}
			siteData={data}
			consentFallback={dictionary.consent}
			isDraftModeEnabled={isDraftModeEnabled}
		>
			<LocaleProvider locale={DEFAULT_LOCALE} dictionary={dictionary}>
				<Layout siteData={data}>{children}</Layout>
			</LocaleProvider>
		</HtmlShell>
	);
}
