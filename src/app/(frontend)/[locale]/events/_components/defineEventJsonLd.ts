import { imageBuilder } from '@/sanity/lib/image';
import { resolveHref } from '@/lib/routes';
import { formatUrl } from '@/lib/utils';

const EVENT_STATUS_MAP: Record<string, string> = {
	confirmed: 'https://schema.org/EventScheduled',
	postponed: 'https://schema.org/EventPostponed',
	tba: 'https://schema.org/EventScheduled',
};

export default function defineEventJsonLd({
	data,
}: {
	data: any;
}): Record<string, unknown> {
	const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';
	const pageRoute = resolveHref({
		documentType: 'pEvent',
		slug: data?.slug ?? null,
	});
	const url = pageRoute ? formatUrl(`${siteUrl}${pageRoute}`) : undefined;

	const heroAsset = data?.heroImage?.image?.asset;
	const image = heroAsset
		? imageBuilder.image(heroAsset).format('webp').width(1200).url()
		: undefined;

	const description = data?.sharing?.metaDesc || data?.subtitle || undefined;
	const isMultiLocation = data?.format === 'multi-location';

	const location = isMultiLocation
		? buildPlace(data?.startEndLocation?.name, data?.startEndLocation?.link)
		: buildPlace(data?.location, data?.locationLink);

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

	return {
		'@context': 'https://schema.org',
		'@type': 'Event',
		name: data?.title ?? '',
		...(description && { description }),
		...(data?.eventDatetime && { startDate: data.eventDatetime }),
		eventStatus:
			EVENT_STATUS_MAP[data?.dateStatus as string] ??
			EVENT_STATUS_MAP.confirmed,
		eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
		...(location && { location }),
		...(image && { image }),
		...(url && { url }),
		organizer: { '@id': `${siteUrl}#organization` },
		...(subEvent && subEvent.length > 0 && { subEvent }),
	};
}

function buildPlace(
	name?: string | null,
	url?: string | null
): Record<string, string> | undefined {
	if (!name) return undefined;
	return { '@type': 'Place', name, ...(url ? { url } : {}) };
}

function buildQuestDescription(station: any): string | undefined {
	const { questTitle, questInstructions } = station ?? {};
	if (!questTitle) return undefined;
	return questInstructions
		? `${questTitle} — ${questInstructions}`
		: questTitle;
}
