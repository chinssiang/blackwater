import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { VisualEditing } from 'next-sanity/visual-editing';
import localFont from 'next/font/local';
import { draftMode } from 'next/headers';
import '@/globals.css';
import { imageBuilder } from '@/sanity/lib/image';
import { sanityFetch } from '@/sanity/lib/live';
import { SanityLive } from '@/sanity/lib/live';
import { siteDataQuery } from '@/sanity/lib/queries';
import ReactQueryProvider from '@/lib/providers/ReactQueryProvider';
import DraftModeToast from '@/components/DraftModeToast';
import { Layout } from '@/components/layout';
import HeadTrackingCode from '@/components/layout/HeadTrackingCode';
import JsonLd from '@/components/JsonLd';
import defineSiteJsonLd from '@/lib/defineSiteJsonLd';
import { Toaster } from 'sonner';
import { SpeedInsights } from '@vercel/speed-insights/next';

const SITE_DATA_TAGS = [
	'gAnnouncement',
	'gHeader',
	'gFooter',
	'settingsMenu',
	'settingsGeneral',
	'settingsIntegration',
	'settingsBrandColors',
] as const;

const getCachedSiteData = cache(() =>
	sanityFetch({ query: siteDataQuery, tags: [...SITE_DATA_TAGS] })
);

const fontABCDisplay = localFont({
	src: [
		{
			path: '../fonts/abc-display-regular.woff2',
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
			path: '../fonts/basel-typewriter.woff2',
			weight: '400',
			style: 'normal',
		},
	],
	variable: '--font-basel-typewriter',
	display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
	const { data } = await getCachedSiteData();
	const { sharing } = stegaClean(data) || ({} as typeof data);

	const { siteTitle } = sharing || {};
	const siteFavicon = sharing?.favicon || false;
	const siteFaviconUrl = siteFavicon
		? imageBuilder.image(siteFavicon).width(256).height(256).url()
		: '/favicon.ico';

	const siteFaviconLight = sharing?.faviconLight || false;
	const siteFaviconLightUrl = siteFaviconLight
		? imageBuilder.image(siteFaviconLight).width(256).height(256).url()
		: siteFaviconUrl;

	const shareGraphic = sharing?.shareGraphic?.asset;
	const shareGraphicUrl = shareGraphic
		? imageBuilder.image(shareGraphic).format('webp').width(1200).url()
		: null;

	const shareVideoUrl = sharing?.shareVideo || null;

	return {
		metadataBase: new URL(process.env.SITE_URL || 'https://blackwaterrc.com'),
		title: {
			template: `%s | ${siteTitle}`,
			default: siteTitle,
		},
		creator: siteTitle,
		publisher: siteTitle,
		applicationName: siteTitle,
		openGraph: {
			title: siteTitle,
			images: shareGraphicUrl
				? [
						{
							url: shareGraphicUrl,
							width: 1200,
							height: 630,
						},
					]
				: [],
			...(shareVideoUrl && {
				videos: [
					{
						url: shareVideoUrl,
						width: 1200,
						height: 630,
						type: 'video/mp4',
					},
				],
			}),
			url: process.env.SITE_URL,
			siteName: siteTitle,
			locale: 'en_US',
			type: 'website',
		},
		icons: {
			icon: [
				{
					url: siteFaviconUrl,
					media: '(prefers-color-scheme: light)',
				},
				{
					url: siteFaviconLightUrl,
					media: '(prefers-color-scheme: dark)',
				},
			],
		},
	};
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const { isEnabled: isDraftModeEnabled } = await draftMode();
	const { data } = await getCachedSiteData();
	const cleanData = stegaClean(data) || ({} as typeof data);
	const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';
	const siteJsonLd = defineSiteJsonLd({ sharing: cleanData?.sharing, siteUrl });

	return (
		<ReactQueryProvider>
			<html
				lang="en"
				className={`${fontABCDisplay.variable} ${baselTypewriter.variable} dark bg-background`}
			>
				<head>
					<meta
						httpEquiv="Content-Type"
						charSet="UTF-8"
						content="text/html;charset=utf-8"
					/>
					<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
					<link rel="preconnect" href="https://cdn.sanity.io" />
					<HeadTrackingCode siteData={data} />
					{siteJsonLd && <JsonLd data={siteJsonLd} />}
				</head>

				<body className="antialiased">
					<Layout siteData={data}>{children}</Layout>
					<SanityLive refreshOnFocus={isDraftModeEnabled} />
					<Toaster />
					{isDraftModeEnabled && (
						<>
							<DraftModeToast />
							<VisualEditing />
						</>
					)}
					<Analytics />
					<SpeedInsights />
				</body>
			</html>
		</ReactQueryProvider>
	);
}
