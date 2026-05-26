import { notFound } from 'next/navigation';
import { LocaleProvider } from '@/components/LocaleProvider';
import { LocaleHtmlLangSync } from '@/components/LocaleHtmlLangSync';
import { Layout } from '@/components/layout';
import { getCachedSiteData } from '@/sanity/lib/siteData';
import { getDictionary } from '@/lib/dictionary.server';
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

	const [{ data }, dictionary] = await Promise.all([
		getCachedSiteData(locale),
		getDictionary(locale as Locale),
	]);

	return (
		<LocaleProvider locale={locale as Locale} dictionary={dictionary}>
			<LocaleHtmlLangSync locale={locale as Locale} />
			<Layout siteData={data}>{children}</Layout>
		</LocaleProvider>
	);
}
