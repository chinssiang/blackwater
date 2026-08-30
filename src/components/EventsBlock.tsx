import { cache } from 'react';
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
import { cn, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import type { Locale } from '@/lib/i18n';

// The events index needs a client clock because a visitor can sit on it while
// events tick over. A home-page strip does not: its host route carries
// `export const revalidate = 3600`, so the wall-clock decision is re-made on the
// server hourly and nothing is corrected after hydration.

// Derived from the query result rather than hand-written, so adding a field to
// eventCardFields can never drift from what this consumes — the convention
// events/page.tsx states for the same fragment.
type EventRow = UpcomingEventsQueryResult[number];

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
			<ul className="border-foreground/20 border-t">
				{rows.map((event, index) => {
					const {
						_id,
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

					// locationRef is the preferred source; `location`/`locationLink` are
					// the one-off fallback the schema hides once a venue is referenced.
					const displayLocation = locationRef?.name || location;
					const displayLocationLink = locationRef?.mapLink || locationLink;
					const href = slug
						? resolveHref({ documentType: 'pEvent', slug, locale })
						: null;

					return (
						<li
							key={_id}
							className="reveal group border-foreground/20 relative flex flex-col gap-1 border-b py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
							style={revealStagger(index)}
						>
							<div className="min-w-0 flex-1">
								<p className="t-b-1 text-balance uppercase">
									{title}
									{href && (
										<ArrowUpRight className="ml-1 inline size-[0.9em] transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
									)}
								</p>
								{subtitle && (
									<p className="t-b-2 text-foreground/60 text-balance">
										{subtitle}
									</p>
								)}
							</div>

							<p className="t-spec shrink-0 uppercase">
								{(!dateStatus || dateStatus === 'confirmed') && eventDatetime
									? formatRichDate(eventDatetime, t.dateFormat, dateFnsLocale)
									: dateStatus || t.status.tba}
							</p>

							{displayLocation && (
								<p className="t-spec min-w-0 shrink-0 uppercase sm:max-w-[14rem] sm:text-right">
									{displayLocationLink ? (
										<a
											href={displayLocationLink}
											target="_blank"
											rel="noopener noreferrer"
											aria-label={displayLocation}
											// Above the row's stretched link (z-10) so the map link
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

							{statusList && statusList.length > 0 && (
								<span className="relative z-10 flex shrink-0 flex-wrap gap-1">
									{statusList.map((item) => (
										<StatusItem key={item._key} data={item as StatusListItem} />
									))}
								</span>
							)}

							{/* Stretched overlay link: any neutral part of the row opens the
							    event, while the map link and status links above stay
							    clickable. Avoids nesting <a> inside <a>. */}
							{href && (
								<Link
									href={href}
									className={cn('absolute inset-0 z-0', OVERLAY_LINK_FOCUS)}
								>
									<span className="sr-only">{title}</span>
								</Link>
							)}
						</li>
					);
				})}
			</ul>
		</SectionShell>
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
