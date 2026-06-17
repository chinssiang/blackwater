import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies, draftMode } from 'next/headers';
import { stegaClean } from '@sanity/client/stega';
import { LocaleProvider } from '@/components/LocaleProvider';
import HtmlShell from '@/components/layout/HtmlShell';
import { getCachedSiteData } from '@/sanity/lib/siteData';
import { getDictionary } from '@/lib/dictionary.server';
import { buildBaseMetadata } from '@/lib/defineBaseMetadata';
import { LOCALES, type Locale, isLocale } from '@/lib/i18n';
import { CONSENT_COOKIE, parseConsentCookie } from '@/lib/consent';

export function generateStaticParams() {
	return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const resolved = (isLocale(locale) ? locale : LOCALES[0]) as Locale;
	const { data } = await getCachedSiteData(resolved);
	const cleanData = stegaClean(data) as { sharing?: unknown } | undefined;
	return buildBaseMetadata(resolved, cleanData?.sharing as never);
}

// Root layout for the locale subtree. Renders <html> per locale (HtmlShell) so
// <html lang> is server-correct. The site chrome lives in (site)/layout.tsx.
export default async function LocaleLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const { isEnabled: isDraftModeEnabled } = await draftMode();
	const [{ data }, dictionary, cookieStore] = await Promise.all([
		getCachedSiteData(locale),
		getDictionary(locale as Locale),
		cookies(),
	]);
	const consent = parseConsentCookie(cookieStore.get(CONSENT_COOKIE)?.value);

	return (
		<HtmlShell
			locale={locale as Locale}
			siteData={data}
			consent={consent}
			isDraftModeEnabled={isDraftModeEnabled}
		>
			<LocaleProvider locale={locale as Locale} dictionary={dictionary}>
				{children}
			</LocaleProvider>
		</HtmlShell>
	);
}
