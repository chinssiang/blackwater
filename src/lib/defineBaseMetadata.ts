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

export function buildBaseMetadata(locale: Locale, sharing: Sharing): Metadata {
	const siteTitle = sharing?.siteTitle || '';

	const siteFavicon = sharing?.favicon || false;
	const siteFaviconUrl = siteFavicon
		? imageBuilder.image(siteFavicon as never).width(256).height(256).url()
		: '/favicon.ico';

	const siteFaviconLight = sharing?.faviconLight || false;
	const siteFaviconLightUrl = siteFaviconLight
		? imageBuilder.image(siteFaviconLight as never).width(256).height(256).url()
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
