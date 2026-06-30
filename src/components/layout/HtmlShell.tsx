import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { stegaClean } from '@sanity/client/stega';
import { VisualEditing } from 'next-sanity/visual-editing';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { htmlLangFor, type Locale } from '@/lib/i18n';
import { SanityLive } from '@/sanity/lib/live';
import ReactQueryProvider from '@/lib/providers/ReactQueryProvider';
import DraftModeToast from '@/components/DraftModeToast';
import HeadTrackingCode from '@/components/layout/HeadTrackingCode';
import ConsentBanner, {
	type ConsentSettings,
} from '@/components/consent/ConsentBanner';
import JsonLd from '@/components/JsonLd';
import defineSiteJsonLd from '@/lib/defineSiteJsonLd';
import type { ConsentState } from '@/lib/consent';
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
	consent,
	consentFallback,
	isDraftModeEnabled,
	children,
}: {
	locale: Locale;
	siteData: unknown;
	consent?: ConsentState | null;
	consentFallback: Dictionary['consent'];
	isDraftModeEnabled: boolean;
	children: React.ReactNode;
}) {
	const cleanData = stegaClean(siteData) as
		| {
				sharing?: Parameters<typeof defineSiteJsonLd>[0]['sharing'];
				consent?: ConsentSettings;
		  }
		| undefined;
	const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';
	const siteJsonLd = defineSiteJsonLd({
		sharing: cleanData?.sharing,
		siteUrl,
		locale,
	});

	return (
		<html
			lang={htmlLangFor(locale)}
			className={`${fontABCDisplay.variable} ${baselTypewriter.variable} bg-background`}
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
				<HeadTrackingCode siteData={siteData as never} consent={consent} />
				{siteJsonLd && <JsonLd data={siteJsonLd} />}
				<ReactQueryProvider>
					<ThemeProvider>
						{children}
						<Toaster />
						{isDraftModeEnabled && (
							<>
								{/* Live Content API: only subscribe in draft mode. For
								    published traffic, content stays fresh via the
								    /api/revalidate-tag webhook. Rendering <SanityLive>
								    for anonymous visitors on Next.js 16 + next-sanity 12
								    triggers a prefetch/revalidate cascade (4–10x request
								    overage). See https://www.sanity.io/docs/help/nextjs-16-sanitylive-status */}
								<SanityLive refreshOnFocus />
								<DraftModeToast />
								<VisualEditing />
							</>
						)}
						<Analytics />
						<SpeedInsights />
						<ConsentBanner
							settings={cleanData?.consent ?? null}
							initialConsent={consent ?? null}
							fallback={consentFallback}
						/>
					</ThemeProvider>
				</ReactQueryProvider>
			</body>
		</html>
	);
}
