import { cache } from 'react';
import dynamic from 'next/dynamic';
import type { UpcomingEventsQueryResult } from 'sanity.types';
import CustomLink from '@/components/CustomLink';
import EventStatusPill, {
	type EventStatusListItem,
} from '@/components/EventStatusPill';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { MapPin } from 'lucide-react';
import { sanityFetch } from '@/sanity/lib/live';
import {
	upcomingEventsQuery,
	UPCOMING_EVENTS_TAGS,
} from '@/sanity/lib/queries';
import { getDictionary } from '@/lib/dictionary.server';
import { formatDaysUntilLabel } from '@/lib/dictionary';
import { resolveEventDateStatus } from '@/lib/event-status';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import {
	formatRichDate,
	getDaysUntilEvent,
	getUpcomingFrom,
	selectUpcomingEvents,
} from '@/lib/event-date';
import { revealStagger } from '@/lib/animate';
import { resolveHref } from '@/lib/routes';
import {
	cn,
	hasArrayValue,
	INLINE_LINK_FOCUS,
	SECTION_INSET_TRAILING_SLIDE,
} from '@/lib/utils';
import type { Locale } from '@/lib/i18n';
type EventRow = UpcomingEventsQueryResult[number];
const EventsCarousel = dynamic(() => import('@/components/EventsCarousel'));

// The basis ladder is what keeps this a row of tickets rather than a row of
// content-width boxes: without it the slides sized to their own text and came
// out 189/437/302/302px wide at 1440. `shrink-0 grow-0` is load-bearing for the
// same reason -- flex would otherwise compress them back to fit.
// The gutter itself lives on the track (`gap-6` in EventsCarousel), not here:
// per-slide padding plus a negative track margin is the older idiom and it
// fights the full-bleed `pl-(--padding-max)`.
const SLIDE_CLASSES = cn(
	'min-w-0 shrink-0 grow-0 basis-[78%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4',
	SECTION_INSET_TRAILING_SLIDE
);
const getCachedUpcomingEvents = cache(
	async (locale: string): Promise<{ data: UpcomingEventsQueryResult }> =>
		sanityFetch({
			query: upcomingEventsQuery,
			params: { locale, upcomingFrom: getUpcomingFrom() },
			tags: [...UPCOMING_EVENTS_TAGS],
		})
);

type EventsBlockProps = {
	data: {
		heading?: string;
		windowDays?: number | null;
		limit?: number | null;
		callToAction?: {
			label?: string | null;
			link?: { href?: unknown; isNewTab?: boolean | null } | null;
		} | null;
		sectionAppearance?: SectionAppearance;
	};
	locale: Locale;
	className?: string;
};

export default async function EventsBlock({
	data,
	locale,
	className,
}: EventsBlockProps) {
	const { heading, windowDays, limit, callToAction, sectionAppearance } =
		data || {};

	const { data: events } = await getCachedUpcomingEvents(locale);
	// Read once and threaded down, so every ticket in the strip counts from the
	// same instant and the selection cannot disagree with what a ticket renders.
	const now = new Date();
	const rows = selectUpcomingEvents(events, { now, windowDays, limit });

	if (rows.length === 0) return null;

	const t = (await getDictionary(locale)).events;
	const dateFnsLocale = DATE_FNS_LOCALES[locale];

	// The authored CTA is an OVERRIDE, not the only source: unset, this still
	// links to the events index with the translated label, so existing content in
	// both datasets keeps the link without anyone editing it.
	//
	// `href` arrives as `unknown` -- resolvedHrefGroq is a select() typegen
	// cannot narrow -- so it is checked rather than cast, exactly as HeroBlock
	// does for its own CTA. Truthiness as well as type: a link authored with an
	// empty URL field resolves to "", which is a string and would otherwise beat
	// the fallback and render the label as inert plain text. The fallback itself
	// always yields a path -- pEvents is registered with `slug: false`.
	const ctaHref =
		typeof callToAction?.link?.href === 'string' && callToAction.link.href
			? callToAction.link.href
			: resolveHref({ documentType: 'pEvents', locale });

	return (
		<SectionShell
			appearance={sectionAppearance}
			heading={heading}
			// On the heading's baseline rather than in the carousel's nav row, where
			// it read as carousel chrome. Rendering it here also keeps it out of
			// <EventsCarousel>, which is a lazily-loaded CLIENT component -- so this
			// markup is server-rendered rather than shipped as client props.
			//
			// The class string and the href narrowing live at this call site because
			// there is exactly one of them. The moment a second module wants a
			// heading link (productsBlock is the obvious next one), lift both into a
			// shared component rather than copying this -- two visually identical
			// links that drift is the same failure SectionShell was extracted to end.
			headingAction={
				<CustomLink
					link={{
						href: ctaHref,
						isNewTab: callToAction?.link?.isNewTab ?? false,
					}}
					className={cn(
						't-spec text-foreground/60 hover:text-foreground shrink-0 rounded uppercase transition-colors',
						INLINE_LINK_FOCUS
					)}
				>
					{callToAction?.label || t.viewAll}
				</CustomLink>
			}
			className={className}
			bleed
		>
			<EventsCarousel
				label={t.carousel.label}
				previousLabel={t.carousel.previous}
				nextLabel={t.carousel.next}
			>
				{rows.map((event, index) => (
					<EventTicket
						key={event._id}
						event={event}
						index={index}
						now={now}
						t={t}
						dateFnsLocale={dateFnsLocale}
					/>
				))}
			</EventsCarousel>
		</SectionShell>
	);
}

// One ticket stub. Extracted for the same reason <EventStatusPill> is: the
// render body above is the module's structure (shell → carousel → N tickets),
// and inlining this buried it under fourteen levels of indentation.
function EventTicket({
	event,
	index,
	now,
	t,
	dateFnsLocale,
}: {
	event: EventRow;
	index: number;
	now: Date;
	t: Awaited<ReturnType<typeof getDictionary>>['events'];
	dateFnsLocale: (typeof DATE_FNS_LOCALES)[Locale];
}) {
	const {
		title,
		subtitle,
		category,
		eventDatetime,
		dateStatus,
		location,
		locationLink,
		locationRef,
		statusList,
	} = event;

	// locationRef is the preferred source; `location`/`locationLink` are the
	// one-off fallback the schema hides once a venue is referenced.
	const displayLocation = locationRef?.name || location;
	const displayLocationLink = locationRef?.mapLink || locationLink;

	// `title` is the codex ("161 RR"), an internal serial that means nothing to
	// someone who has not been to a run; `subtitle` is the human name ("Midweek
	// Reset (6K / 10K)"). The name leads and the codex becomes spec data beside
	// the category. `subtitle` is optional on pEvent (only length-capped), so it
	// can be absent -- then the codex is the only name there is and it heads the
	// card, which is also why it is not repeated in the stub in that case.
	const heading = subtitle || title;
	const codex = subtitle ? title : null;

	// One gate for everything that assumes the date is real: a TBA, postponed or
	// cancelled event must not render a date or count down to one. The helper
	// cleans the stega metadata draft mode encodes into the enum -- see its note.
	const dateStatusInfo = resolveEventDateStatus(dateStatus, t);
	const daysUntil = dateStatusInfo.isFirm
		? getDaysUntilEvent(eventDatetime, now)
		: null;
	const daysUntilLabel =
		daysUntil === null ? null : formatDaysUntilLabel(daysUntil, t);

	return (
		<div
			role="group"
			aria-roledescription="slide"
			// `aria-roledescription` needs an accessible name, or a screen reader
			// announces a bare "slide" for every ticket. `aria-label` rather than
			// pointing at the <h3>: no id to keep unique across two eventsBlock
			// modules that can both render the same event.
			aria-label={heading ?? undefined}
			data-slot="carousel-item"
			className={SLIDE_CLASSES}
		>
			<article
				className="reveal border-foreground/20 flex h-full flex-col rounded border py-4"
				style={revealStagger(index)}
			>
				{(category || codex) && (
					<p className="t-spec wrap-anywhere px-4 uppercase">
						{category || codex}
					</p>
				)}

				<div className="mt-3 px-4">
					<h3 className="t-h-3 leading-snug text-balance uppercase">
						{heading}
					</h3>
					{/* `.t-spec` is line-height 1 and this wraps on the narrow mobile
					    card (zh_tw dates are longer), which clips ascenders. */}
					<p className="t-spec text-foreground/60 mt-1.5 leading-snug uppercase">
						{dateStatusInfo.isFirm && eventDatetime
							? formatRichDate(eventDatetime, t.dateFormat, dateFnsLocale)
							: dateStatusInfo.label}
					</p>
				</div>

				<div className="mt-auto space-y-2.5 px-4 pt-6">
					{displayLocation && (
						// `items-start` + flex, not an inline icon: the venue wraps to two
						// lines on the narrow mobile card, and this keeps the pin on the
						// first line with the text hanging beside it rather than under it.
						<p className="t-spec flex items-start gap-1.5 leading-snug uppercase">
							<MapPin className="mt-px size-3 shrink-0" aria-hidden />
							{displayLocationLink ? (
								<a
									href={displayLocationLink}
									target="_blank"
									rel="noopener noreferrer"
									className={cn(
										'rounded transition-[color,box-shadow] hover:text-foreground/60',
										INLINE_LINK_FOCUS
									)}
								>
									{displayLocation}
								</a>
							) : (
								displayLocation
							)}
						</p>
					)}

					{(daysUntilLabel || hasArrayValue(statusList)) && (
						<span className="flex flex-wrap gap-1">
							{/* Same pill, same window (getDaysUntilEvent) and same wording
							    (formatDaysUntilLabel) as the /events row, so "in 2 days"
							    cannot mean two different things on two pages. Uncoloured, so
							    it reads as a cue beside the authored status pills rather
							    than competing with them. */}
							{daysUntilLabel && (
								<EventStatusPill
									data={{ eventStatus: { title: daysUntilLabel } }}
								/>
							)}
							{statusList?.map((item) => (
								<EventStatusPill
									key={item._key}
									data={item as EventStatusListItem}
								/>
							))}
						</span>
					)}
				</div>
			</article>
		</div>
	);
}
