import type { Metadata } from 'next';
import { imageBuilder } from '@/sanity/lib/image';
import { ogLocaleFor, LOCALES, type Locale } from '@/lib/i18n';

type Sharing =
	| {
			siteTitle?: string | null;
			favicon?: unknown;
			faviconLight?: unknown;
			shareGraphic?: { asset?: unknown } | null;
			shareVideo?: string | null;
	  }
	| null
	| undefined;

// Favicon edge length, used for both the Sanity transform and nothing else —
// one constant so the two can't drift.
const FAVICON_SIZE = 256;

// Serve a Sanity-hosted icon from our own origin. Favicons are fetched with
// credentials, so a raw cdn.sanity.io URL made the browser attach the
// `sanitySession` cookie to a third-party host. /api/favicon streams the bytes
// unchanged rather than going through /_next/image, whose Accept-based fallback
// re-encodes to JPEG and would flatten a transparent PNG onto a solid
// background. Keeping the asset in Sanity means editors can still change it.
function sameOrigin(image: unknown): string {
	const url = imageBuilder
		.image(image as never)
		.width(FAVICON_SIZE)
		.height(FAVICON_SIZE)
		.url();
	return `/api/favicon?url=${encodeURIComponent(url)}`;
}

export function buildBaseMetadata(locale: Locale, sharing: Sharing): Metadata {
	const siteTitle = sharing?.siteTitle || '';

	const siteFavicon = sharing?.favicon || false;
	const siteFaviconUrl = siteFavicon
		? sameOrigin(siteFavicon)
		: '/favicon.ico';

	const siteFaviconLight = sharing?.faviconLight || false;
	const siteFaviconLightUrl = siteFaviconLight
		? sameOrigin(siteFaviconLight)
		: siteFaviconUrl;

	const shareGraphic = sharing?.shareGraphic?.asset;
	const shareGraphicUrl = shareGraphic
		? imageBuilder.image(shareGraphic as never).format('webp').width(1200).url()
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
			locale: ogLocaleFor(locale),
			alternateLocale: LOCALES.filter((l) => l !== locale).map(ogLocaleFor),
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
