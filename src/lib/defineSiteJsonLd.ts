import { imageBuilder } from '@/sanity/lib/image';
import { type Locale, htmlLangFor } from '@/lib/i18n';

type SocialLink = { icon?: string | null; url?: string | null };

type SiteSharing = {
	siteTitle?: string | null;
	siteDescription?: string | null;
	siteLogo?: unknown;
	shareGraphic?: unknown;
	contactEmail?: string | null;
	socialLinks?: SocialLink[] | null;
} | null | undefined;

export default function defineSiteJsonLd({
	sharing,
	siteUrl,
	locale,
}: {
	sharing: SiteSharing;
	siteUrl: string;
	locale?: Locale;
}): Record<string, unknown> | null {
	const siteTitle = sharing?.siteTitle ?? undefined;
	if (!siteTitle) return null;

	const orgId = `${siteUrl}#organization`;
	const siteId = `${siteUrl}#website`;
	const description = sharing?.siteDescription || undefined;

	const logoUrl = sharing?.siteLogo
		? imageBuilder.image(sharing.siteLogo as never).format('webp').width(512).url()
		: undefined;

	const imageUrl = sharing?.shareGraphic
		? imageBuilder
				.image(sharing.shareGraphic as never)
				.format('webp')
				.width(1200)
				.url()
		: undefined;

	const sameAs = (sharing?.socialLinks ?? [])
		.map((s) => s?.url?.trim())
		.filter((u): u is string => !!u);

	const contactEmail = sharing?.contactEmail?.trim() || undefined;

	const organization = {
		'@type': 'Organization',
		'@id': orgId,
		name: siteTitle,
		url: siteUrl,
		...(description && { description }),
		...(logoUrl && { logo: logoUrl }),
		...(imageUrl && { image: imageUrl }),
		...(sameAs.length > 0 && { sameAs }),
		...(contactEmail && {
			contactPoint: {
				'@type': 'ContactPoint',
				contactType: 'customer service',
				email: contactEmail,
			},
		}),
	};

	const website = {
		'@type': 'WebSite',
		'@id': siteId,
		url: siteUrl,
		name: siteTitle,
		...(description && { description }),
		publisher: { '@id': orgId },
		...(locale && { inLanguage: htmlLangFor(locale) }),
	};

	return {
		'@context': 'https://schema.org',
		'@graph': [organization, website],
	};
}
