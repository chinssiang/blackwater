import { LocaleProvider } from '@/components/LocaleProvider';
import { Layout } from '@/components/layout';
import HtmlShell from '@/components/layout/HtmlShell';
import { sanityFetch } from '@/sanity/lib/live';
import { page404Query } from '@/sanity/lib/queries';
import { getCachedSiteData } from '@/sanity/lib/siteData';
import { getDictionary } from '@/lib/dictionary.server';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { PageNotFound } from './(frontend)/[locale]/_components/PageNotFound';

// App-root fallback for genuinely-unmatched URLs outside the [locale] subtree
// (e.g. a bad /email-signature/* subpath). Self-contained <html> via HtmlShell.
// The data-not-found marker hides Newsletter/Footer via globals.css.
export default async function NotFound() {
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
			isDraftModeEnabled={false}
		>
			<LocaleProvider locale={DEFAULT_LOCALE} dictionary={dictionary}>
				<Layout siteData={siteData}>
					<div data-not-found="">
						<PageNotFound data={data} />
					</div>
				</Layout>
			</LocaleProvider>
		</HtmlShell>
	);
}
