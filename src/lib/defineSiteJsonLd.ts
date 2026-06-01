import { imageBuilder } from '@/sanity/lib/image';
import { type Locale, htmlLangFor } from '@/lib/i18n';

type SocialLink = { icon?: string | null; url?: string | null };

type Address = {
	streetAddress?: string | null;
	addressLocality?: string | null;
	addressRegion?: string | null;
	postalCode?: string | null;
	addressCountry?: string | null;
} | null;

type SiteSharing = {
	siteTitle?: string | null;
	siteDescription?: string | null;
	alternateName?: string | null;
	areaServed?: string | null;
	foundingDate?: string | null;
	address?: Address;
	siteLogo?: unknown;
	shareGraphic?: unknown;
	contactEmail?: string | null;
	socialLinks?: SocialLink[] | null;
} | null | undefined;

const LANGUAGE_TAGS = ['en', 'zh-TW'];

function buildPostalAddress(
	address: Address
): Record<string, string> | undefined {
	if (!address) return undefined;
	const entries: [string, string][] = [];
	for (const key of [
		'streetAddress',
		'addressLocality',
		'addressRegion',
		'postalCode',
		'addressCountry',
	] as const) {
		const value = address[key]?.trim();
		if (value) entries.push([key, value]);
	}
	if (entries.length === 0) return undefined;
	return { '@type': 'PostalAddress', ...Object.fromEntries(entries) };
}

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
	const alternateName = sharing?.alternateName?.trim() || undefined;
	const areaServed = sharing?.areaServed?.trim() || undefined;
	const foundingDate = sharing?.foundingDate?.trim() || undefined;
	const address = buildPostalAddress(sharing?.address ?? null);

	const organization = {
		// SportsOrganization carries the `sport` signal ("a running club");
		// Organization is retained for broad compatibility.
		'@type': ['Organization', 'SportsOrganization'],
		'@id': orgId,
		name: siteTitle,
		...(alternateName && { alternateName }),
		url: siteUrl,
		...(description && { description }),
		sport: 'Running',
		knowsLanguage: LANGUAGE_TAGS,
		...(areaServed && { areaServed }),
		...(foundingDate && { foundingDate }),
		...(address && { address }),
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
