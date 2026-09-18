import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCachedSiteData } from '@/sanity/lib/siteData';
import { stegaClean } from '@sanity/client/stega';
import { buildBaseMetadata } from '@/lib/defineBaseMetadata';
import { getDictionary } from '@/lib/dictionary.server';
import { LOCALES, type Locale, isLocale } from '@/lib/i18n';
import { LocaleProvider } from '@/components/LocaleProvider';
import HtmlShell from '@/components/layout/HtmlShell';

export function generateStaticParams() {
	return LOCALES.map((locale) => ({ locale }));
}

// A `locale` outside LOCALES is a 404 before anything renders, and this is the
// only thing that makes that true. The `notFound()` in the layout below does
// NOT stop the matching PAGE from rendering — React renders a layout and its
// page concurrently — so a request like /foo.txt (which src/proxy.ts leaves
// alone, because its matcher skips dotted paths) matched /[locale] with
// locale="foo.txt" and rendered the HOMEPAGE with that string, where
// EventsBlock's and ProductsBlock's `getDictionary(locale)` threw
// "c[a] is not a function". The result was an opaque HTTP 500, not a 404, on
// EVERY dotted URL in production — /llms.txt, /ads.txt, /security.txt,
// /apple-touch-icon.png — which is also what Lighthouse's llms-txt audit
// reported. /email-signature/bogus took the same path via [locale]/(site)/[slug].
//
// Note this option is unavailable under `cacheComponents` (see the note in
// next.config.mjs on why that flag is still off); if it is ever enabled, the
// locale check has to move into the pages themselves.
export const dynamicParams = false;

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
	// NOTE: deliberately no cookies() here. Reading a Dynamic API in this root
	// layout opted every /[locale]/* route out of static generation (measured:
	// all `ƒ` + cache-control: no-store; without it the whole subtree is `●`). The
	// consent decision is read in the browser instead — see src/hooks/useConsent.
	const [{ data }, dictionary] = await Promise.all([
		getCachedSiteData(locale),
		getDictionary(locale as Locale),
	]);

	return (
		<HtmlShell
			locale={locale as Locale}
			siteData={data}
			consentFallback={dictionary.consent}
			isDraftModeEnabled={isDraftModeEnabled}
			enableTracking
		>
			<LocaleProvider locale={locale as Locale} dictionary={dictionary}>
				{children}
			</LocaleProvider>
		</HtmlShell>
	);
}
