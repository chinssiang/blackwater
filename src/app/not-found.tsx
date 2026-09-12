import { draftMode } from 'next/headers';
import { LocaleProvider } from '@/components/LocaleProvider';
import { Layout } from '@/components/layout';
import HtmlShell from '@/components/layout/HtmlShell';
import { sanityFetch } from '@/sanity/lib/live';
import { page404Query } from '@/sanity/lib/queries';
import { getCachedSiteData, pickLayoutData } from '@/sanity/lib/siteData';
import { getDictionary } from '@/lib/dictionary.server';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { PageNotFound } from './(frontend)/[locale]/_components/PageNotFound';

// App-root fallback for genuinely-unmatched URLs outside the [locale] subtree
// (e.g. a bad /email-signature/* subpath). Self-contained <html> via HtmlShell.
// The data-not-found marker hides Newsletter/Footer via globals.css.
export default async function NotFound() {
	// Read the real flag rather than hardcoding false: `sanityFetch` below derives
	// stega from its own `draftMode()` read, so an editor arriving here in draft
	// mode gets stega-encoded copy whatever this says — and with the trio
	// suppressed there is no overlay to consume the markers and no toast to leave
	// draft mode from.
	const { isEnabled: isDraftModeEnabled } = await draftMode();
	const [{ data: siteData }, { data }, dictionary] = await Promise.all([
		getCachedSiteData(DEFAULT_LOCALE),
		sanityFetch({
			query: page404Query,
			params: { locale: DEFAULT_LOCALE },
			tags: ['p404'],
		}),
		getDictionary(DEFAULT_LOCALE),
	]);

	return (
		<HtmlShell
			locale={DEFAULT_LOCALE}
			siteData={siteData}
			consentFallback={dictionary.consent}
			isDraftModeEnabled={isDraftModeEnabled}
		>
			<LocaleProvider locale={DEFAULT_LOCALE} dictionary={dictionary}>
				<Layout siteData={pickLayoutData(siteData)}>
					<div data-not-found="">
						<PageNotFound data={data} />
					</div>
				</Layout>
			</LocaleProvider>
		</HtmlShell>
	);
}
