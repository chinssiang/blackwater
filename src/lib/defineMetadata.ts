// https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadata-fields
import type { Metadata } from 'next';
import { imageBuilder } from '@/sanity/lib/image';
import { resolveHref } from '@/lib/routes';
import { formatUrl } from '@/lib/utils';

type Props = {
	data: {
		sharing?: any;
		title?: string;
		isHomepage?: boolean;
		_type?: string;
		slug?: string;
	};
};

export default function defineMetadata({ data }: Props): Metadata {
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
	});

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
		},
		twitter: {
			card: 'summary_large_image',
			title: metaTitle,
			...(metaDesc && { description: metaDesc }),
			creator: siteTitle,
			images: shareGraphicUrl ? [shareGraphicUrl] : [],
		},
		alternates: {
			...(pageRoute && {
				canonical: formatUrl(`${process.env.SITE_URL}${pageRoute}`),
			}),
			// TODO: Enable when site is multilingual
			// languages: {
			// 	'en-US': '/en-US',
			// },
		},
		robots: {
			index: !disableIndex,
			follow: !disableIndex,
			nocache: true,
		},
	};
}
