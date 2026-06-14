import type { Metadata } from 'next';
import { NotFoundContent } from '@/app/(frontend)/[locale]/_components/NotFoundContent';
import { cache } from 'react';
import { stegaClean } from '@sanity/client/stega';
import { sanityFetch } from '@/sanity/lib/live';
import { pEventsQuery } from '@/sanity/lib/queries';
import defineMetadata, { normalizeLocales } from '@/lib/defineMetadata';
import { resolveHref } from '@/lib/routes';
import { formatUrl } from '@/lib/utils';
import { buildEventName } from '@/lib/buildEventName';
import { formatRichDate } from '@/lib/event-date';
import JsonLd from '@/components/JsonLd';
import { type Locale, htmlLangFor } from '@/lib/i18n';
import type { RichDate } from 'sanity.types';
import { PageEvents } from './_components/PageEvents';

const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';

type EventListItem = {
	title?: string;
	subtitle?: string;
	slug?: string;
	location?: string;
	locationRef?: { name?: string | null } | null;
	eventDatetime?: RichDate | null;
};

function defineEventsItemListJsonLd(
	eventList: Array<EventListItem>,
	locale: Locale
): Record<string, unknown> | null {
	const itemListElement = (eventList || [])
		.map((event, i) => {
			const href = resolveHref({ documentType: 'pEvent', slug: event?.slug, locale });
			if (!event?.title || !href) return null;
			return {
				'@type': 'ListItem',
				position: i + 1,
				name: buildEventName(
					{
						title: event.title,
						subtitle: event.subtitle,
						location: event.locationRef?.name || event.location,
						eventDatetime: event.eventDatetime?.utc,
						timezone: event.eventDatetime?.timezone,
					},
					locale
				),
				url: formatUrl(`${siteUrl}${href}`),
			};
		})
		.filter(Boolean);

	if (itemListElement.length === 0) return null;
	return {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		inLanguage: htmlLangFor(locale),
		itemListElement,
	};
}

// Only fetch events from the last N months forward. The listing defaults to the
// first upcoming month and rarely surfaces deep history, so bounding the past
// keeps the payload (and the locale-dedup subquery) roughly constant as events
// accumulate over the years.
const EVENTS_PAST_WINDOW_MONTHS = 12;

function getEventsCutoff(): string {
	const cutoff = new Date();
	cutoff.setMonth(cutoff.getMonth() - EVENTS_PAST_WINDOW_MONTHS);
	cutoff.setHours(0, 0, 0, 0);
	return cutoff.toISOString();
}

const getCachedEventsData = cache(async (locale: string) =>
	sanityFetch({
		query: pEventsQuery,
		params: { locale, cutoff: getEventsCutoff() },
		tags: ['pEvents', 'pEvent'],
	})
);

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
	const { locale } = await props.params;
	const { data } = await getCachedEventsData(locale);
	const cleanData = stegaClean(data);
	return defineMetadata({
		data: cleanData,
		locale: locale as Locale,
		availableLocales: normalizeLocales(cleanData?.availableLocales),
	});
}

export default async function Page(props: Props) {
	const { locale } = await props.params;
	const { data } = await getCachedEventsData(locale);

	if (!data) return <NotFoundContent locale={locale} />;

	const { eventList } = data || {};
	const groupedEvents = eventList.reduce(
		(
			acc: Record<string, (typeof eventList)[number][]>,
			event: (typeof eventList)[number]
		) => {
			const key =
				formatRichDate(event.eventDatetime, 'yyyy_MMMM').toLowerCase() ||
				'unknown';

			if (!acc[key]) {
				acc[key] = [];
			}
			acc[key].push(event);

			return acc;
		},
		{}
	);

	const cleanList = stegaClean(eventList);
	const itemListJsonLd = defineEventsItemListJsonLd(
		cleanList,
		locale as Locale
	);

	return (
		<>
			{itemListJsonLd && <JsonLd data={itemListJsonLd} />}
			<PageEvents data={{ groupedEvents, ...data }} />
		</>
	);
}
