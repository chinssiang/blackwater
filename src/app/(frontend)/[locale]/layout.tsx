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

// A `locale` outside LOCALES must be a 404, and NOT via `dynamicParams = false`
// here: Next applies that flag to the whole route, layouts included, so it made
// every nested dynamic route ([slug], events/[slug], products/[slug], …)
// fallback:false and a document published after a deploy 404'd until the next
// build. The `notFound()` in the layout below is the check instead. It does not
// stop the matching PAGE from rendering — React renders a layout and its page
// concurrently — so a request like /foo.txt (which src/proxy.ts leaves alone,
// because its matcher skips dotted paths) still renders the page with
// locale="foo.txt". That page used to throw first ("c[a] is not a function" from
// `getDictionary`), turning every dotted URL into a 500; getDictionary now
// falls back to English for an unknown locale so the layout's 404 wins.

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
