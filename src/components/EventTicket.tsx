import Link from 'next/link';
import type { RichDate } from 'sanity.types';
import { MapPin } from 'lucide-react';
import EventStatusPill, {
	type EventStatusListItem,
} from '@/components/EventStatusPill';
import { formatDaysUntilLabel, type Dictionary } from '@/lib/dictionary';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import { formatRichDate, getDaysUntilEvent } from '@/lib/event-date';
import { resolveEventDateStatus } from '@/lib/event-status';
import { revealStagger } from '@/lib/animate';
import { resolveHref } from '@/lib/routes';
import {
	cn,
	hasArrayValue,
	INLINE_LINK_FOCUS,
	OVERLAY_LINK_FOCUS,
	SECTION_INSET_TRAILING_SLIDE,
} from '@/lib/utils';
import type { Locale } from '@/lib/i18n';

// Typed structurally rather than off any one query result, because the two
// surfaces that render a ticket -- the eventsBlock carousel and the event
// page's related strips -- read different projections of the same fields.
export type EventTicketRow = {
	title?: string | null;
	subtitle?: string | null;
	category?: string | null;
	slug?: string | null;
	eventDatetime?: RichDate | null;
	dateStatus?: string | null;
	location?: string | null;
	locationLink?: string | null;
	locationRef?: { name?: string | null; mapLink?: string | null } | null;
	statusList?: EventStatusListItem[] | null;
};

// The basis ladder is what keeps a carousel of these a row of tickets rather
// than a row of content-width boxes: without it the slides sized to their own
// text and came out 189/437/302/302px wide at 1440. `shrink-0 grow-0` is
// load-bearing for the same reason -- flex would otherwise compress them back
// to fit.
// The gutter itself lives on the track (`gap-6` in EventsCarousel), not here:
// per-slide padding plus a negative track margin is the older idiom and it
// fights the full-bleed `pl-(--padding-max)`.
// A template literal, not cn(): both halves are static, so a module-scope cn()
// call would be tailwind-merge work done on every page load and thrown away.
export const EVENT_SLIDE_CLASSES = `min-w-0 shrink-0 grow-0 basis-[78%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4 ${SECTION_INSET_TRAILING_SLIDE}`;

// One ticket stub.
export function EventTicket({
	event,
	index,
	locale,
	now,
	t,
	dateFnsLocale,
}: {
	event: EventTicketRow;
	index: number;
	locale: Locale;
	now: Date;
	t: Dictionary['events'];
	dateFnsLocale: (typeof DATE_FNS_LOCALES)[Locale];
}) {
	const {
		title,
		subtitle,
		category,
		slug,
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
	const href = slug
		? resolveHref({ documentType: 'pEvent', slug, locale })
		: null;

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
		// `group` and `relative` carry the stretched link below; no hover or
		// transition utility on this element, because it is also the `reveal` root
		// -- a Tailwind transition utility here rewrites the entrance's own
		// `transition-property` and kills it silently. The card-level hover lives
		// on the heading instead.
		<article
			className="reveal group border-foreground/20 relative flex h-full flex-col rounded border py-4"
			style={revealStagger(index)}
		>
			{/* The stub: what kind of run, and which one. The category is the
			    decoder for the codex -- "161 RR" is a "Road Run (RR)" -- and it is
			    the one line that tells a first-time visitor what this card is. */}
			{(category || codex) && (
				<p className="t-spec wrap-anywhere px-4 uppercase">
					{category || codex}
				</p>
			)}

			{/* No arrow on the heading. Everywhere else on this site ArrowUpRight
			    marks an EXTERNAL link (the map link below, and every use on /events
			    and the event page); on an internal link to the event it inverted the
			    icon's meaning. The stretched link plus the heading's ink change
			    carries the affordance. */}
			<div className="mt-3 px-4">
				<h3 className="t-l-0 group-hover:text-foreground/60 text-balance uppercase transition-colors">
					{heading}
				</h3>
				<p className="t-spec text-foreground/60 mt-1.5 uppercase">
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
					<p className="t-spec flex items-start gap-1.5 uppercase">
						<MapPin className="mt-px size-3 shrink-0" aria-hidden />
						{displayLocationLink ? (
							<a
								href={displayLocationLink}
								target="_blank"
								rel="noopener noreferrer"
								// Above the ticket's stretched link (z-10) so the map link
								// stays individually clickable.
								className={cn(
									'hover:text-foreground/60 relative z-10 rounded transition-[color,box-shadow]',
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
					<span className="relative z-10 flex flex-wrap gap-1">
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
							<EventStatusPill key={item._key} data={item} />
						))}
					</span>
				)}
			</div>

			{/* Stretched overlay link: any neutral part of the ticket opens the event,
			    while the map link and status pills above (z-10) stay individually
			    clickable. Avoids nesting <a> inside <a>. Without it the related
			    strips on the event page -- whose whole point is moving between
			    related runs -- would be dead cards. */}
			{href && (
				<Link
					href={href}
					className={cn('absolute inset-0 z-0 rounded', OVERLAY_LINK_FOCUS)}
				>
					{/* Names the destination, not just what happens to be visible: the
					    heading is the subtitle, so the codex would otherwise be
					    announced nowhere and two runs could sound identical. */}
					<span className="sr-only">
						{[heading, codex].filter(Boolean).join(', ')}
					</span>
				</Link>
			)}
		</article>
	);
}

// The slide wrapper embla expects around a ticket. A hand-written stand-in for
// ui/Carousel's CarouselItem, which cannot be imported here without pulling
// embla into the static client graph (see EventsCarousel's comment) -- so the
// role/aria-roledescription/data-slot triple is a contract with that primitive,
// and it lives in one place rather than being restated by every strip.
export function EventTicketSlide({
	event,
	index,
	locale,
	now,
	t,
	dateFnsLocale,
}: {
	event: EventTicketRow;
	index: number;
	locale: Locale;
	now: Date;
	t: Dictionary['events'];
	dateFnsLocale: (typeof DATE_FNS_LOCALES)[Locale];
}) {
	return (
		<div
			role="group"
			aria-roledescription="slide"
			// `aria-roledescription` needs an accessible name, or a screen reader
			// announces a bare "slide" for every ticket. `aria-label` rather than
			// pointing at the <h3>: no id to keep unique across two eventsBlock
			// modules that can both render the same event.
			aria-label={event.subtitle || event.title || undefined}
			data-slot="carousel-item"
			className={EVENT_SLIDE_CLASSES}
		>
			<EventTicket
				event={event}
				index={index}
				locale={locale}
				now={now}
				t={t}
				dateFnsLocale={dateFnsLocale}
			/>
		</div>
	);
}
