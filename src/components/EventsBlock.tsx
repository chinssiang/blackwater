import { cache } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { UpcomingEventsQueryResult } from 'sanity.types';
import CustomLink from '@/components/CustomLink';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { ArrowRight } from '@/components/SvgIcons';
import { sanityFetch } from '@/sanity/lib/live';
import {
	upcomingEventsQuery,
	UPCOMING_EVENTS_TAGS,
} from '@/sanity/lib/queries';
import { getDictionary } from '@/lib/dictionary.server';
import { formatDaysUntilLabel } from '@/lib/dictionary';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import {
	formatEventTimeLabel,
	getDaysUntilEvent,
	readEventDateStatus,
	getUpcomingFrom,
	selectUpcomingEvents,
} from '@/lib/event-date';
import {
	buildRgbaCssString,
	ensureAccessibleTextColor,
	type SanityColor,
} from '@/lib/image-utils';
import { revealStagger } from '@/lib/animate';
import { resolveHref } from '@/lib/routes';
import {
	cn,
	hasArrayValue,
	OVERLAY_LINK_FOCUS,
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
						OVERLAY_LINK_FOCUS
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
					<div
						key={event._id}
						role="group"
						aria-roledescription="slide"
						data-slot="carousel-item"
						className={SLIDE_CLASSES}
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
				))}
			</EventsCarousel>
		</SectionShell>
	);
}

// One ticket stub. Extracted for the same reason StatusItem below is: the
// render body above is the module's structure (shell → carousel → N tickets),
// and inlining this buried it under fourteen levels of indentation.
function EventTicket({
	event,
	index,
	locale,
	now,
	t,
	dateFnsLocale,
}: {
	event: EventRow;
	index: number;
	locale: Locale;
	now: Date;
	t: Awaited<ReturnType<typeof getDictionary>>['events'];
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
	// the category. `subtitle` carries no validation on pEvent, so it can be
	// absent -- then the codex is the only name there is and it heads the card,
	// which is also why it is not repeated in the stub in that case.
	const heading = subtitle || title;
	const codex = subtitle ? title : null;

	// One gate for everything that assumes the date is real: a TBA, postponed or
	// cancelled event must not render a date or count down to one. It lives in
	// event-date.ts so this and the two /events views cannot drift, and so the
	// stega cleaning it does happens everywhere rather than here only.
	const dateIsFirm = readEventDateStatus(dateStatus) === null;
	const daysUntil = dateIsFirm ? getDaysUntilEvent(eventDatetime, now) : null;
	const daysUntilLabel =
		daysUntil === null ? null : formatDaysUntilLabel(daysUntil, t);

	return (
		<article
			className="reveal group border-foreground/20 relative flex h-full flex-col rounded border py-4 transition-colors duration-300 hover:border-foreground/50"
			style={revealStagger(index)}
		>
			{/* The stub: what kind of run, and which one. The category is the
			    decoder for the codex -- "161 RR" is a "Road Run (RR)" -- and it is
			    the one line that tells a first-time visitor what this card is. */}
			{(category || codex) && (
				<p className="t-spec flex items-baseline justify-between gap-2 px-4 uppercase">
					<span className="truncate">{category || codex}</span>
					{category && codex && (
						<span className="text-foreground/60 shrink-0">{codex}</span>
					)}
				</p>
			)}

			{/* The perforation: what makes a bordered box read as a ticket stub
			    rather than a plain card. Full bleed on purpose -- inset by the
			    card's padding it read as a divider; running edge to edge it reads
			    as a tear line, which is the whole point of the motif. That is why
			    the article carries `py-4` and each zone carries its own `px-4`. */}
			<div
				aria-hidden
				className="border-foreground/20 mt-3 border-t border-dashed"
			/>

			{/* No `flex-1` here: the slack belongs between this block and the
			    footer (`mt-auto` below), not wrapped around the title. Height is
			    content-driven -- `aspect-square` forced a 326px box around ~120px
			    of type, and because the ratio was tied to width the emptiness grew
			    with the viewport. Tickets in a row still match heights, from the
			    carousel track's own `align-items: stretch` plus `h-full`. */}
			{/* No arrow on the heading. Everywhere else on this site ArrowUpRight
			    marks an EXTERNAL link (the map links below, and every use on
			    /events and the event page); on an internal link to the event it
			    inverted the icon's meaning. The stretched link plus the border
			    hover carries the affordance. */}
			<div className="mt-5 px-4">
				<h3 className="t-h-3 line-clamp-3 text-balance uppercase">{heading}</h3>
				<p className="t-spec text-foreground/60 mt-1.5 uppercase">
					{formatEventTimeLabel(event, t.dateFormat, t.status, dateFnsLocale)}
				</p>
			</div>

			<div className="mt-auto space-y-1.5 px-4 pt-6">
				{displayLocation && (
					<p className="t-spec line-clamp-1 uppercase">
						{displayLocationLink ? (
							<a
								href={displayLocationLink}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={displayLocation}
								// Above the ticket's stretched link (z-10) so the map link
								// stays individually clickable.
								className={cn(
									'relative z-10 underline-offset-4 hover:underline',
									OVERLAY_LINK_FOCUS
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
							<StatusItem data={{ eventStatus: { title: daysUntilLabel } }} />
						)}
						{statusList?.map((item) => (
							<StatusItem key={item._key} data={item as StatusListItem} />
						))}
					</span>
				)}
			</div>

			{/* Stretched overlay link: any neutral part of the ticket opens the event,
			    while the map link and status pills above (z-10) stay individually
			    clickable. Avoids nesting <a> inside <a>. */}
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

// Mirrors the pill on /events. Colours come from the referenced brand-colour
// documents, with ensureAccessibleTextColor deciding the foreground against the
// authored background; the var() fallbacks keep it legible when a status has no
// colours set.
// Typed structurally rather than off the query result: typegen widens the two
// brand-colour derefs to `{} | Color | null` and the link's resolved `href` to
// `unknown` (resolvedHrefGroq is a select() it cannot narrow), so the generated
// shape does not fit its own consumers. PageEvents' copy sidesteps this with
// `data: any`; naming the fields keeps the looseness to the two values that
// actually need it.
type StatusListItem = {
	link?: { href?: unknown; isNewTab?: boolean | null } | null;
	eventStatus?: {
		title?: string | null;
		statusTextColor?: SanityColor | null;
		statusBgColor?: SanityColor | null;
	} | null;
};

function StatusItem({ data }: { data: StatusListItem }) {
	const { link, eventStatus } = data || {};
	if (!eventStatus) return null;
	const { title, statusTextColor, statusBgColor } = eventStatus;
	// Narrowed rather than cast: `href` comes back as `unknown` because
	// resolvedHrefGroq is a select() typegen cannot fold, and a status whose link
	// resolves to nothing should render as a plain pill.
	const linkHref = typeof link?.href === 'string' ? link.href : null;

	return (
		<span
			className="t-b-2 relative flex items-center gap-0.5 rounded-4xl px-2.5 py-1 uppercase"
			style={{
				color:
					ensureAccessibleTextColor(statusTextColor, statusBgColor) ||
					'var(--foreground)',
				backgroundColor: buildRgbaCssString(statusBgColor) || 'var(--muted)',
			}}
		>
			{title}
			{linkHref && (
				<>
					<ArrowRight className="size-3" />
					<CustomLink
						className={cn('p-fill rounded-4xl', OVERLAY_LINK_FOCUS)}
						link={{ href: linkHref, isNewTab: link?.isNewTab ?? false }}
						aria-label={title ?? undefined}
					/>
				</>
			)}
		</span>
	);
}
