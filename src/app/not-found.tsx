import { draftMode } from 'next/headers';
import { sanityFetch } from '@/sanity/lib/live';
import { page404Query } from '@/sanity/lib/queries';
import { getCachedSiteData, pickLayoutData } from '@/sanity/lib/siteData';
import { getDictionary } from '@/lib/dictionary.server';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { LocaleProvider } from '@/components/LocaleProvider';
import { Layout } from '@/components/layout';
import HtmlShell from '@/components/layout/HtmlShell';
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
	// The two SANITY fetches are guarded, unlike every other fetch site in the
	// app: this page IS the error path. There is no error.tsx under src/app
	// (deliberately — see the note in PageHome on why), so a throw here answers
	// an opaque 500 to a request that should have been a 404, and the visitor
	// gets no chrome and no way back. A Sanity outage should cost the 404 its
	// authored copy, nothing more.
	//
	// Always LOGGED before the fallback is returned. Swallowing silently makes
	// the only symptom a 404 rendered with an empty header, footer and nav, which
	// nothing alerts on and which on-call has no trace to correlate — the degraded
	// page is supposed to be invisible to the visitor, not to us.
	//
	// `getDictionary` is deliberately NOT guarded, so this page can still throw:
	// its fallback would have to be a hardcoded English copy of the consent
	// strings, and a dictionary that fails to load is a build/deploy fault rather
	// than an upstream outage — there is nothing to degrade to.
	function logFallback(source: string, error: unknown) {
		console.error(`[not-found] ${source} failed; rendering fallback`, error);
	}
	const [siteData, data, dictionary] = await Promise.all([
		getCachedSiteData(DEFAULT_LOCALE)
			.then((r) => r.data)
			.catch((error) => {
				logFallback('getCachedSiteData', error);
				return undefined;
			}),
		sanityFetch({
			query: page404Query,
			params: { locale: DEFAULT_LOCALE },
			tags: ['p404'],
		})
			.then((r) => r.data)
			.catch((error) => {
				logFallback('page404Query', error);
				return null;
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
