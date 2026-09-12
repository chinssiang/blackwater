import { cache } from 'react';
import dynamic from 'next/dynamic';
import type { RelatedEventsQueryResult } from 'sanity.types';
import SectionShell from '@/components/SectionShell';
import { EventTicketSlide } from '@/components/EventTicket';
import SectionHeadingLink from '@/components/SectionHeadingLink';
import { sanityFetch } from '@/sanity/lib/live';
import { relatedEventsQuery, RELATED_EVENTS_TAGS } from '@/sanity/lib/queries';
import { interpolate, type Dictionary } from '@/lib/dictionary';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import { isEventEnded } from '@/lib/event-date';
import { resolveHref } from '@/lib/routes';
import { cn, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import type { Locale } from '@/lib/i18n';

type RelatedRow = NonNullable<RelatedEventsQueryResult>['series'][number];

const EventsCarousel = dynamic(() => import('@/components/EventsCarousel'));

// Its own fetch, deliberately NOT nested in pageEventSingleQuery -- and the
// reason is tags, not just cache keys. /api/revalidate-tag fires
// revalidateTag(_type) AND revalidateTag(`${_type}:${slug}`), and the page's own
// read is scoped to `pEvent:${slug}` so publishing event B cannot expire event
// A's document. This strip has to expire when B changes, so it needs the broad
// `pEvent` tag -- nesting it would put that tag on the page's own fetch, which
// generateMetadata awaits through the same cache(), and every publish would then
// invalidate the metadata of all 178 event pages and pull 8 related rows just to
// read `sharing`.
//
export const getCachedRelatedEvents = cache(
	async (
		slug: string,
		locale: string
	): Promise<{ data: RelatedEventsQueryResult }> =>
		sanityFetch({
			query: relatedEventsQuery,
			params: { slug, locale },
			tags: [...RELATED_EVENTS_TAGS],
		})
);

// Rows arrive newest-first, which already puts anything upcoming ahead of the
// past. Within the upcoming half that order is backwards though -- the furthest
// future event leads -- so reverse just that half and let the past follow,
// newest first. isEventEnded rather than a raw date compare: it needs the
// event's own timezone and an end-of-day fallback when endDatetime is blank.
function orderByRelevance(rows: RelatedRow[], now: Date): RelatedRow[] {
	const upcoming: RelatedRow[] = [];
	const ended: RelatedRow[] = [];
	for (const row of rows) {
		(isEventEnded(row.eventDatetime, row.endDatetime, now)
			? ended
			: upcoming
		).push(row);
	}
	return [...upcoming.reverse(), ...ended];
}

export default async function EventRelated({
	slug,
	locale,
	t,
}: {
	slug: string;
	locale: Locale;
	t: Dictionary['events'];
}) {
	const { data } = await getCachedRelatedEvents(slug, locale);
	if (!data) return null;

	// One instant for the whole render, so two strips cannot disagree about what
	// has ended -- the same discipline EventsBlock follows.
	const now = new Date();

	const series = orderByRelevance(data.series ?? [], now);
	// The venue arm overlaps the series arm whenever an event shares both with
	// its sibling -- 17 of the 34 events that have a venue. Showing those twice
	// would make the second strip read as a duplicate of the first, so the venue
	// strip gets only what the series strip did not already show, and renders
	// only if anything survives.
	const seriesIds = new Set(series.map((row) => row._id));
	const venue = orderByRelevance(
		(data.venue ?? []).filter((row) => !seriesIds.has(row._id)),
		now
	);

	if (series.length === 0 && venue.length === 0) return null;

	const eventsHref = resolveHref({ documentType: 'pEvents', locale });

	return (
		<>
			{series.length > 0 && (
				<EventStrip
					heading={
						data.categoryTitle
							? interpolate(t.related.series, {
									category: data.categoryTitle,
								})
							: t.related.seriesGeneric
					}
					rows={series}
					locale={locale}
					now={now}
					t={t}
					// Only the first strip carries the "all events" link: repeating it
					// on the second reads as chrome rather than a way out.
					actionHref={eventsHref}
				/>
			)}
			{venue.length > 0 && data.locationName && (
				<EventStrip
					heading={interpolate(t.related.venue, {
						location: data.locationName,
					})}
					rows={venue}
					locale={locale}
					now={now}
					t={t}
				/>
			)}
		</>
	);
}

function EventStrip({
	heading,
	rows,
	locale,
	now,
	t,
	actionHref,
}: {
	heading: string;
	rows: RelatedRow[];
	locale: Locale;
	now: Date;
	t: Dictionary['events'];
	actionHref?: string | null;
}) {
	// Derived from `locale` rather than taken as a prop: the two could otherwise
	// be passed as a disagreeing pair.
	const dateFnsLocale = DATE_FNS_LOCALES[locale];
	return (
		<SectionShell
			heading={heading}
			// Rendered here rather than inside <EventsCarousel>, which is a lazily
			// loaded CLIENT component -- keeping it out means this markup is
			// server-rendered instead of shipped as client props. Same reasoning as
			// EventsBlock's copy; the class string is duplicated because there are
			// only two, and lifting it would be the shared-component call the
			// EventsBlock comment already flags for whoever adds a third.
			// Conditional, NOT an element that renders null: SectionShell keys its
			// flex heading row on this prop's truthiness, and its comment explains
			// that an always-flex heading defeats text-align. A SectionHeadingLink
			// with no href renders nothing but is still a truthy element.
			headingAction={
				actionHref ? (
					<SectionHeadingLink href={actionHref}>{t.viewAll}</SectionHeadingLink>
				) : undefined
			}
			bleed
		>
			<EventsCarousel
				label={heading}
				previousLabel={t.carousel.previous}
				nextLabel={t.carousel.next}
			>
				{rows.map((event, index) => (
					<EventTicketSlide
						key={event._id}
						event={event}
						index={index}
						locale={locale}
						now={now}
						t={t}
						dateFnsLocale={dateFnsLocale}
					/>
				))}
			</EventsCarousel>
		</SectionShell>
	);
}
