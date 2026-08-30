import { stegaClean } from '@sanity/client/stega';
import CustomLink from '@/components/CustomLink';
import { ArrowRight, ArrowUpRight } from '@/components/SvgIcons';
import { getDictionary } from '@/lib/dictionary.server';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import { formatRichDate, selectUpcomingEvents } from '@/lib/event-date';
import {
	buildRgbaCssString,
	ensureAccessibleTextColor,
} from '@/lib/image-utils';
import { revealStagger } from '@/lib/animate';
import { resolveHref } from '@/lib/routes';
import type { Locale } from '@/lib/i18n';
import { cn, getSpacingClass } from '@/lib/utils';
import Link from 'next/link';

// Server Component on purpose: the whole thing is a read of already-fetched data
// plus a date comparison, and rendering it on the server keeps the JS off the
// page. The events index needs a client clock because a visitor may sit on it
// while events tick over; a home-page strip does not — its host route carries
// `export const revalidate = 3600`, which is what keeps the wall-clock decision
// from being frozen at build time.

type MaxWidthType = 'none' | 'xl' | 'l' | 'm' | 's' | 'xs';

type EventRow = {
	_id?: string;
	title?: string | null;
	subtitle?: string | null;
	slug?: string | null;
	eventDatetime?: any;
	endDatetime?: any;
	dateStatus?: string | null;
	location?: string | null;
	locationLink?: string | null;
	locationRef?: { name?: string | null; mapLink?: string | null } | null;
	statusList?: any[] | null;
};

type EventsBlockProps = {
	data: {
		heading?: string;
		timeWindow?: string | null;
		limit?: number | null;
		events?: EventRow[] | null;
		sectionAppearance?: any;
	};
	locale: Locale;
	className?: string;
};

export default async function EventsBlock({
	data,
	locale,
	className,
}: EventsBlockProps) {
	const { heading, events, timeWindow, limit, sectionAppearance } = data || {};

	const rows = selectUpcomingEvents(events, {
		now: new Date(),
		// stegaClean before comparing: in draft mode Sanity encodes invisible
		// metadata into every string, so a raw `timeWindow` matches no case and the
		// window silently widens to "all upcoming".
		timeWindow: stegaClean(timeWindow) ?? undefined,
		limit,
	});

	// Same bail as FaqBlock: a window with nothing in it renders no heading and no
	// empty state, rather than an orphaned title. The schema description warns
	// editors that a narrow window can do this.
	if (rows.length === 0) return null;

	const dict = await getDictionary(locale);
	const t = dict.events;
	const dateFnsLocale = DATE_FNS_LOCALES[locale];

	const {
		backgroundColor,
		textColor,
		textAlign = 'text-left',
		maxWidth = 'none',
		spacingTop,
		spacingBottom,
		spacingTopDesktop,
		spacingBottomDesktop,
	} = (sectionAppearance as {
		backgroundColor?: any;
		textColor?: any;
		textAlign?: string;
		maxWidth?: MaxWidthType;
		spacingTop?: any;
		spacingBottom?: any;
		spacingTopDesktop?: any;
		spacingBottomDesktop?: any;
	}) || {};

	const hasBackground = !!backgroundColor;

	const spacingClasses = [
		getSpacingClass('marginTop', spacingTop, hasBackground),
		getSpacingClass('marginBottom', spacingBottom, hasBackground),
		getSpacingClass('marginTopDesktop', spacingTopDesktop, hasBackground),
		getSpacingClass('marginBottomDesktop', spacingBottomDesktop, hasBackground),
	].filter(Boolean);

	// Freeform's key set, not FaqBlock's: sectionAppearance only ever emits
	// none|xl|l|m|s|xs, so FaqBlock's `lg`/`md` keys are unreachable.
	const maxWidthClasses =
		(
			{
				none: 'w-full',
				xl: 'max-w-7xl',
				l: 'max-w-5xl',
				m: 'max-w-3xl',
				s: 'max-w-xl',
				xs: 'max-w-xs',
			} as const
		)[maxWidth] || 'w-full';

	return (
		<section
			className={cn(
				'px-contain mx-auto',
				textAlign,
				maxWidthClasses,
				...spacingClasses,
				className
			)}
			style={{
				color: buildRgbaCssString(textColor) || 'inherit',
				backgroundColor: buildRgbaCssString(backgroundColor) || undefined,
			}}
		>
			{heading && <h2 className="t-h-3 mb-6 uppercase">{heading}</h2>}

			<ul className="border-t border-foreground/20">
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

					// stegaClean so draft mode cannot turn 'confirmed' into a miss and
					// print the encoded string where the date belongs.
					const cleanDateStatus = stegaClean(dateStatus);
					const showDate =
						(!cleanDateStatus || cleanDateStatus === 'confirmed') &&
						eventDatetime;

					const href = slug
						? resolveHref({ documentType: 'pEvent', slug, locale })
						: null;

					return (
						<li
							key={_id ?? `event-${index}`}
							className="reveal group relative flex flex-col gap-1 border-b border-foreground/20 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
							style={revealStagger(index)}
						>
							<div className="min-w-0 flex-1">
								<p className="t-b-1 font-bold text-balance uppercase">
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
								{showDate
									? formatRichDate(eventDatetime, t.dateFormat, dateFnsLocale)
									: cleanDateStatus || t.status.tba}
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
											className="relative z-10 underline-offset-4 hover:underline"
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
									{statusList.map((item: any) => (
										<StatusItem key={item?._key} data={item} />
									))}
								</span>
							)}

							{/* Stretched overlay link: any neutral part of the row opens the
							    event, while the map link and status links above stay
							    clickable. Avoids nesting <a> inside <a>. */}
							{href && (
								<Link
									href={href}
									className="absolute inset-0 z-0 focus-visible:ring-accent-foreground focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								>
									<span className="sr-only">{title}</span>
								</Link>
							)}
						</li>
					);
				})}
			</ul>
		</section>
	);
}

// Mirrors the pill on /events. Colours come from the referenced brand-colour
// documents, with ensureAccessibleTextColor deciding the foreground against the
// authored background; the var() fallbacks keep it legible when a status has no
// colours set.
function StatusItem({ data }: { data: any }) {
	const { link, eventStatus } = data || {};
	if (!eventStatus) return null;
	const { title, statusTextColor, statusBgColor } = eventStatus;

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
			{link?.href && (
				<>
					<ArrowRight className="size-3" />
					<CustomLink
						className="p-fill rounded-4xl"
						link={link}
						aria-label={title}
					/>
				</>
			)}
		</span>
	);
}
