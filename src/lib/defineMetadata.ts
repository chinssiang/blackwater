// https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadata-fields
import type { Metadata } from 'next';
import { imageBuilder } from '@/sanity/lib/image';
import { resolveHref } from '@/lib/routes';
import { formatUrl } from '@/lib/utils';
import {
	type Locale,
	DEFAULT_LOCALE,
	htmlLangFor,
	ogLocaleFor,
	isLocale,
} from '@/lib/i18n';

type Props = {
	data: {
		sharing?: any;
		title?: string;
		isHomepage?: boolean;
		_type?: string;
		slug?: string;
	};
	locale?: Locale;
	availableLocales?: Locale[];
};

export function normalizeLocales(raw: unknown): Locale[] {
	const arr = Array.isArray(raw) ? raw : [];
	const filtered = [...new Set(arr.filter(isLocale))] as Locale[];
	return filtered.length > 0 ? filtered : [DEFAULT_LOCALE];
}

export default function defineMetadata({
	data,
	locale = DEFAULT_LOCALE,
	availableLocales = [DEFAULT_LOCALE],
}: Props): Metadata {
	const { sharing, title, isHomepage, _type, slug } = data || {};

	const siteTitle = sharing?.siteTitle || '';
	const metaDesc = sharing?.metaDesc || '';
	const metaTitle = sharing?.metaTitle || title || `Page not found`;
	const shareGraphic = sharing?.shareGraphic?.asset;
	const shareGraphicUrl = shareGraphic
		? imageBuilder.image(shareGraphic).format('webp').width(1200).url()
		: null;

	const disableIndex = sharing?.disableIndex;

	const pageRoute = resolveHref({
		documentType: _type ?? null,
		slug: slug ?? null,
		locale,
	});

	const canonicalUrl = pageRoute
		? formatUrl(`${process.env.SITE_URL}${pageRoute}`)
		: undefined;

	// Build hreflang map only when multiple locales are available for this document
	let languagesMap: Record<string, string> | undefined;
	if (availableLocales.length > 1) {
		const entries: [string, string][] = [];
		for (const l of availableLocales) {
			const href = resolveHref({ documentType: _type ?? null, slug: slug ?? null, locale: l });
			if (href) {
				entries.push([htmlLangFor(l), formatUrl(`${process.env.SITE_URL}${href}`)]);
			}
		}
		const defaultHref = resolveHref({ documentType: _type ?? null, slug: slug ?? null, locale: DEFAULT_LOCALE });
		if (defaultHref) {
			entries.push(['x-default', formatUrl(`${process.env.SITE_URL}${defaultHref}`)]);
		}
		if (entries.length > 0) languagesMap = Object.fromEntries(entries);
	}

	const alternateLocales = availableLocales.filter((l) => l !== locale);

	return {
		...(isHomepage ? null : { title: metaTitle }),
		...(metaDesc && { description: metaDesc }),
		openGraph: {
			title: metaTitle,
			...(metaDesc && { description: metaDesc }),
			images: shareGraphicUrl
				? [
						{
							url: shareGraphicUrl,
							width: 1200,
							height: 630,
						},
					]
				: [],
			locale: ogLocaleFor(locale),
			...(alternateLocales.length > 0 && {
				alternateLocale: alternateLocales.map(ogLocaleFor),
			}),
		},
		twitter: {
			card: 'summary_large_image',
			title: metaTitle,
			...(metaDesc && { description: metaDesc }),
			creator: siteTitle,
			images: shareGraphicUrl ? [shareGraphicUrl] : [],
		},
		alternates: {
			...(canonicalUrl && { canonical: canonicalUrl }),
			...(languagesMap && { languages: languagesMap }),
		},
		robots: {
			index: !disableIndex,
			follow: !disableIndex,
			googleBot: {
				index: !disableIndex,
				follow: !disableIndex,
				'max-image-preview': 'large',
				'max-snippet': -1,
				'max-video-preview': -1,
			},
		},
	};
}
