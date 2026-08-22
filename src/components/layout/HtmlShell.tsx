import DraftModeTools from '@/components/DraftModeTools';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { stegaClean } from '@sanity/client/stega';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { htmlLangFor, type Locale } from '@/lib/i18n';
import ReactQueryProvider from '@/lib/providers/ReactQueryProvider';
import HeadTrackingCode, {
	type TrackingIntegrations,
} from '@/components/layout/HeadTrackingCode';
import ConsentBanner, {
	type ConsentSettings,
} from '@/components/consent/ConsentBanner';
import JsonLd from '@/components/JsonLd';
import defineSiteJsonLd from '@/lib/defineSiteJsonLd';
import type { Dictionary } from '@/lib/dictionary';
import '@/globals.css';

const fontABCDisplay = localFont({
	src: [
		{
			path: '../../app/fonts/abc-display-regular.woff2',
			weight: '400',
			style: 'normal',
		},
	],
	variable: '--font-ABC-Display',
	display: 'swap',
});

const baselTypewriter = localFont({
	src: [
		{
			path: '../../app/fonts/basel-typewriter.woff2',
			weight: '400',
			style: 'normal',
		},
	],
	variable: '--font-basel-typewriter',
	display: 'swap',
});

export default function HtmlShell({
	locale,
	siteData,
	consentFallback,
	isDraftModeEnabled,
	// Opt-in, and only the [locale] subtree opts in. The shells that render this
	// from outside that subtree — /email-signature, /events-crew and the root
	// 404 — have never loaded analytics, and an internal crew tool is not a
	// place to start collecting pageviews.
	enableTracking = false,
	children,
}: {
	locale: Locale;
	siteData: unknown;
	consentFallback: Dictionary['consent'];
	isDraftModeEnabled: boolean;
	enableTracking?: boolean;
	children: React.ReactNode;
}) {
	const cleanData = stegaClean(siteData) as
		| {
				sharing?: Parameters<typeof defineSiteJsonLd>[0]['sharing'];
				consent?: ConsentSettings;
		  }
		| undefined;
	// Only the three ids the tags need, not all of siteData: HeadTrackingCode is
	// a client component, so whatever it receives is serialized into the RSC
	// payload. Read raw rather than from cleanData to keep the previous behavior.
	const integrations = (
		siteData as { integrations?: TrackingIntegrations } | undefined
	)?.integrations;
	const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';
	const siteJsonLd = defineSiteJsonLd({
		sharing: cleanData?.sharing,
		siteUrl,
		locale,
	});

	return (
		<html
			lang={htmlLangFor(locale)}
			className={`${fontABCDisplay.variable} ${baselTypewriter.variable} bg-background scrollbar-gutter-stable`}
			data-scroll-behavior="smooth"
			suppressHydrationWarning
		>
			<body className="antialiased">
				<meta
					httpEquiv="Content-Type"
					charSet="UTF-8"
					content="text/html;charset=utf-8"
				/>
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
				<link rel="preconnect" href="https://cdn.sanity.io" />
				{enableTracking && <HeadTrackingCode integrations={integrations} />}
				{siteJsonLd && <JsonLd data={siteJsonLd} />}
				<ReactQueryProvider>
					<ThemeProvider>
						{children}
						<Toaster />
						<DraftModeTools enabled={isDraftModeEnabled} />
						{/* Deliberately NOT consent-gated, unlike GA/GTM. Neither package
						    touches document.cookie, localStorage, sessionStorage or
						    indexedDB (verified in their dist bundles) — they beacon to the
						    first-party /_vercel/insights and /_vercel/speed endpoints. With
						    no storage on the visitor's device there is no ePrivacy 5(3)
						    consent trigger, and aggregate audience/performance measurement
						    rests on legitimate interest. Gating Speed Insights would also
						    make it useless: Core Web Vitals from a consenting-only subset
						    is a biased sample of the very thing it exists to measure. */}
						<Analytics />
						<SpeedInsights />
						<ConsentBanner
							settings={cleanData?.consent ?? null}
							fallback={consentFallback}
						/>
					</ThemeProvider>
				</ReactQueryProvider>
			</body>
		</html>
	);
}
