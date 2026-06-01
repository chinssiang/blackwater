import { imageBuilder } from '@/sanity/lib/image';
import { resolveHref } from '@/lib/routes';
import { formatUrl } from '@/lib/utils';
import { type Locale, htmlLangFor } from '@/lib/i18n';

const EVENT_STATUS_MAP: Record<string, string> = {
	confirmed: 'https://schema.org/EventScheduled',
	postponed: 'https://schema.org/EventPostponed',
	tba: 'https://schema.org/EventScheduled',
	cancelled: 'https://schema.org/EventCancelled',
};

type AddressLike = {
	streetAddress?: string | null;
	addressLocality?: string | null;
	addressRegion?: string | null;
	postalCode?: string | null;
	addressCountry?: string | null;
} | null;

function buildPostalAddress(
	address: AddressLike
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
		const value = address[key]?.trim?.();
		if (value) entries.push([key, value]);
	}
	if (entries.length === 0) return undefined;
	return { '@type': 'PostalAddress', ...Object.fromEntries(entries) };
}

export default function defineEventJsonLd({
	data,
	locale,
}: {
	data: any;
	locale?: Locale;
}): Record<string, unknown> {
	const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';
	const pageRoute = resolveHref({
		documentType: 'pEvent',
		slug: data?.slug ?? null,
		locale,
	});
	const url = pageRoute ? formatUrl(`${siteUrl}${pageRoute}`) : undefined;

	const heroAsset = data?.heroImage?.image?.asset;
	const image = heroAsset
		? imageBuilder.image(heroAsset).format('webp').width(1200).url()
		: undefined;

	const description =
		data?.sharing?.metaDesc || data?.excerpt || data?.subtitle || undefined;
	const isMultiLocation = data?.format === 'multi-location';

	// Prefer the structured location reference (carries address + geo) for
	// single-location events; fall back to the free-text location.
	const ref = data?.locationRef;
	const location = isMultiLocation
		? buildPlace(data?.startEndLocation?.name, data?.startEndLocation?.link)
		: buildPlace(ref?.name || data?.location, ref?.mapLink || data?.locationLink, {
				address: ref?.address,
				geo: ref?.geo,
			});

	const subEvent =
		isMultiLocation && Array.isArray(data?.stations) && data.stations.length > 0
			? data.stations
					.map((s: any, i: number) => {
						const place = buildPlace(s?.locationName, s?.locationLink);
						if (!place) return null;
						const questDesc = buildQuestDescription(s);
						return {
							'@type': 'Event',
							name: s?.name
								? `Station ${i + 1}: ${s.name}`
								: `Station ${i + 1}`,
							...(questDesc && { description: questDesc }),
							location: place,
							...(data?.eventDatetime && { startDate: data.eventDatetime }),
						};
					})
					.filter(Boolean)
			: undefined;

	const keywords = Array.isArray(data?.categories)
		? data.categories
				.map((c: any) => c?.title)
				.filter((t: unknown): t is string => typeof t === 'string' && !!t)
		: [];
	if (data?.eventType) keywords.push(data.eventType);

	return {
		'@context': 'https://schema.org',
		'@type': 'Event',
		name: data?.title ?? '',
		...(description && { description }),
		...(data?.eventDatetime && { startDate: data.eventDatetime }),
		...(data?.endDatetime && { endDate: data.endDatetime }),
		eventStatus:
			EVENT_STATUS_MAP[data?.dateStatus as string] ??
			EVENT_STATUS_MAP.confirmed,
		eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
		sport: 'Running',
		...(keywords.length > 0 && { keywords }),
		...(location && { location }),
		...(image && { image }),
		...(url && { url }),
		...(locale && { inLanguage: htmlLangFor(locale) }),
		...(typeof data?.isFree === 'boolean' && {
			isAccessibleForFree: data.isFree,
		}),
		organizer: { '@id': `${siteUrl}#organization` },
		...(subEvent && subEvent.length > 0 && { subEvent }),
	};
}

function buildPlace(
	name?: string | null,
	url?: string | null,
	extra?: {
		address?: AddressLike;
		geo?: { lat?: number | null; lng?: number | null } | null;
	}
): Record<string, unknown> | undefined {
	if (!name) return undefined;
	const address = buildPostalAddress(extra?.address ?? null);
	const lat = extra?.geo?.lat;
	const lng = extra?.geo?.lng;
	const hasGeo = typeof lat === 'number' && typeof lng === 'number';
	return {
		'@type': 'Place',
		name,
		...(url ? { url } : {}),
		...(address && { address }),
		...(hasGeo && {
			geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng },
		}),
	};
}

function buildQuestDescription(station: any): string | undefined {
	const { questTitle, questInstructions } = station ?? {};
	if (!questTitle) return undefined;
	return questInstructions
		? `${questTitle} — ${questInstructions}`
		: questTitle;
}
