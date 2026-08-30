import { cache } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { UpcomingEventsQueryResult } from 'sanity.types';
import CustomLink from '@/components/CustomLink';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { ArrowRight, ArrowUpRight } from '@/components/SvgIcons';
import { sanityFetch } from '@/sanity/lib/live';
import {
	upcomingEventsQuery,
	UPCOMING_EVENTS_TAGS,
} from '@/sanity/lib/queries';
import { getDictionary } from '@/lib/dictionary.server';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import {
	formatRichDate,
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
import { cn, hasArrayValue, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import type { Locale } from '@/lib/i18n';

// The events index needs a client clock because a visitor can sit on it while
// events tick over. A home-page strip does not: its host route carries
// `export const revalidate = 3600`, so the wall-clock decision is re-made on the
// server hourly and nothing is corrected after hydration.

// Derived from the query result rather than hand-written, so adding a field to
// eventCardFields can never drift from what this consumes — the convention
// events/page.tsx states for the same fragment.
type EventRow = UpcomingEventsQueryResult[number];

// Lazy so embla stays out of the shared client graph of every page that can
// carry modules — see the header of EventsCarousel.tsx for why that matters and
// why nothing here may import `ui/Carousel` directly.
const EventsCarousel = dynamic(() => import('@/components/EventsCarousel'));

// The slide wrapper, inlined rather than imported from `ui/Carousel`. The
// primitive's <CarouselItem> is a client component that reads only
// `orientation` from context; this carousel never sets it, so the class list is
// fully determined here — and a plain server div keeps N tickets per page out of
// the flight payload as client references. `data-slot` is load-bearing: the
// primitive's key handler only claims Left/Right for elements whose slot starts
// with "carousel".
const SLIDE_CLASSES =
	// Roughly one-and-a-bit tickets on a phone, so the cut edge of the next one
	// advertises that the strip scrolls.
	'min-w-0 shrink-0 grow-0 pl-4 basis-[78%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4';

// Annotated, not inferred: upcomingEventsQuery is built from interpolated
// helpers, so TypeScript cannot fold it into the string literal that indexes
// Sanity's query→result map, and `data` would silently arrive as `any`.
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
	const { heading, windowDays, limit, sectionAppearance } = data || {};

	const { data: events } = await getCachedUpcomingEvents(locale);
	const rows = selectUpcomingEvents(events, {
		now: new Date(),
		windowDays,
		limit,
	});

	// Same bail as FaqBlock: a window with nothing in it renders no heading and no
	// empty state, rather than an orphaned title. The schema description warns
	// editors that a narrow window can do this.
	if (rows.length === 0) return null;

	const t = (await getDictionary(locale)).events;
	const dateFnsLocale = DATE_FNS_LOCALES[locale];

	return (
		<SectionShell
			appearance={sectionAppearance}
			heading={heading}
			className={className}
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
							t={t}
							dateFnsLocale={dateFnsLocale}
						/>
					</div>
				))}
			</EventsCarousel>
		</SectionShell>
	);
}

// One square ticket. Extracted for the same reason StatusItem below is: the
// render body above is the module's structure (shell → carousel → N tickets),
// and inlining this buried it under fourteen levels of indentation.
function EventTicket({
	event,
	index,
	locale,
	t,
	dateFnsLocale,
}: {
	event: EventRow;
	index: number;
	locale: Locale;
	t: Awaited<ReturnType<typeof getDictionary>>['events'];
	dateFnsLocale: (typeof DATE_FNS_LOCALES)[Locale];
}) {
	const {
		title,
		subtitle,
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

	return (
		<article
			className="reveal group border-foreground/20 relative flex aspect-square flex-col rounded border p-4 transition-colors duration-300 hover:border-foreground/50"
			style={revealStagger(index)}
		>
			<p className="t-spec uppercase">
				{(!dateStatus || dateStatus === 'confirmed') && eventDatetime
					? formatRichDate(eventDatetime, t.dateFormat, dateFnsLocale)
					: dateStatus || t.status.tba}
			</p>

			{/* The perforation: what makes a bordered square read as a ticket stub
			    rather than a plain card. */}
			<div
				aria-hidden
				className="border-foreground/20 my-3 border-t border-dashed"
			/>

			<div className="min-h-0 flex-1">
				<h3 className="t-h-3 line-clamp-3 text-balance uppercase">
					{title}
					{href && (
						<ArrowUpRight className="ml-1 inline size-[0.9em] transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
					)}
				</h3>
				{subtitle && (
					<p className="t-b-2 text-foreground/60 mt-1 line-clamp-2 text-balance">
						{subtitle}
					</p>
				)}
			</div>

			<div className="mt-3 space-y-2">
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

				{hasArrayValue(statusList) && (
					<span className="relative z-10 flex flex-wrap gap-1">
						{statusList.map((item) => (
							<StatusItem key={item._key} data={item as StatusListItem} />
						))}
					</span>
				)}
			</div>

			{/* Stretched overlay link: any neutral part of the ticket opens the event,
			    while the map link and status links above stay clickable. Avoids
			    nesting <a> inside <a>. */}
			{href && (
				<Link
					href={href}
					className={cn('absolute inset-0 z-0 rounded', OVERLAY_LINK_FOCUS)}
				>
					<span className="sr-only">{title}</span>
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
	_key: string;
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
