import { notFound } from 'next/navigation';
import { LocaleProvider } from '@/components/LocaleProvider';
import { LocaleHtmlLangSync } from '@/components/LocaleHtmlLangSync';
import { Layout } from '@/components/layout';
import { getCachedSiteData } from '@/sanity/lib/siteData';
import { LOCALES, type Locale, isLocale } from '@/lib/i18n';

export function generateStaticParams() {
	return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const { data } = await getCachedSiteData(locale);

	return (
		<LocaleProvider locale={locale as Locale}>
			<LocaleHtmlLangSync locale={locale as Locale} />
			<Layout siteData={data}>{children}</Layout>
		</LocaleProvider>
	);
}
