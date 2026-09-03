import Link from 'next/link';
import type { RichDate } from 'sanity.types';
import CustomLink from '@/components/CustomLink';
import { ArrowRight } from '@/components/SvgIcons';
import {
	formatDateStatusLabel,
	formatDaysUntilLabel,
	type Dictionary,
} from '@/lib/dictionary';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import {
	formatRichDate,
	getDaysUntilEvent,
	isDateFirm,
} from '@/lib/event-date';
import {
	buildRgbaCssString,
	ensureAccessibleTextColor,
	type MaybeSanityColor,
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

// Shared by the three surfaces that render an event: the eventsBlock carousel,
// the /events listing rows and the event detail page. Typed structurally rather
// than off any one query result, because the three read different projections
// of the same fields -- and because typegen widens the two brand-colour derefs
// to `{} | Color | null` and the link's resolved `href` to `unknown`
// (resolvedHrefGroq is a select() it cannot narrow), so no generated shape fits
// its own consumers. Naming the fields keeps the looseness to the two values
// that actually need it.
export type StatusListItem = {
	_key?: string | null;
	link?: { href?: unknown; isNewTab?: boolean | null } | null;
	eventStatus?: {
		title?: string | null;
		// MaybeSanityColor, because typegen projects each brand-colour deref as
		// `{} | Color | null`. The colour helpers in image-utils accept and
		// narrow that shape themselves, so nothing here needs a cast.
		statusTextColor?: MaybeSanityColor;
		statusBgColor?: MaybeSanityColor;
	} | null;
};

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
	statusList?: StatusListItem[] | null;
};

// The basis ladder is what keeps a carousel of these a row of tickets rather
// than a row of content-width boxes: without it the slides sized to their own
// text and came out 189/437/302/302px wide at 1440. `shrink-0 grow-0` is
// load-bearing for the same reason -- flex would otherwise compress them back
// to fit.
// The gutter itself lives on the track (`gap-6` in EventsCarousel), not here:
// per-slide padding plus a negative track margin is the older idiom and it
// fights the full-bleed `pl-(--padding-max)`.
// A template literal, not cn(): both halves are static, and PageEvents pulls
// this module into the /events client graph for StatusItem — a module-scope
// cn() call there is tailwind-merge work done on every page load and thrown
// away.
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
	// the category. `subtitle` carries no validation on pEvent, so it can be
	// absent -- then the codex is the only name there is and it heads the card,
	// which is also why it is not repeated in the stub in that case.
	const heading = subtitle || title;
	const codex = subtitle ? title : null;

	const dateIsFirm = isDateFirm(dateStatus);
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
					{dateIsFirm && eventDatetime
						? formatRichDate(eventDatetime, t.dateFormat, dateFnsLocale)
						: formatDateStatusLabel(dateStatus, t)}
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
							<StatusItem key={item._key} data={item} />
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

// Colours come from the referenced brand-colour documents, with
// ensureAccessibleTextColor deciding the foreground against the authored
// background.
//
// The two var() fallbacks are load-bearing as a PAIR, not just an empty-state
// nicety. When a status authors no background this pill's surface is
// var(--muted) -- a theme token the server cannot resolve -- so the helper
// returns false rather than guess, and var(--foreground) is what makes the
// result legible in both themes (7.73:1 dark, 18.16:1 light against --muted).
// Do not "simplify" either side to a literal colour, and do not fall back to
// the authored ink here: that is the exact bug the helper's early return now
// prevents. See the comment in ensureAccessibleTextColor.
//
// The base padding is the ticket's (`py-1`); the /events row and the event
// page pass `py-2` through `className`, which tailwind-merge resolves.
export function StatusItem({
	data,
	className,
}: {
	data: StatusListItem;
	className?: string;
}) {
	const { link, eventStatus } = data;
	if (!eventStatus) return null;
	const { title, statusTextColor, statusBgColor } = eventStatus;
	// Narrowed rather than cast: `href` comes back as `unknown` because
	// resolvedHrefGroq is a select() typegen cannot fold, and a status whose link
	// resolves to nothing should render as a plain pill.
	const linkHref = typeof link?.href === 'string' ? link.href : null;

	return (
		<span
			className={cn(
				't-b-2 relative flex items-center gap-0.5 rounded-4xl px-2.5 py-1 uppercase',
				className
			)}
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
