'use client';

import { useId, useMemo } from 'react';
import Link from 'next/link';
import CustomLink from '@/components/CustomLink';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { ArrowUpRight } from '@/components/SvgIcons';
import { revealStagger } from '@/lib/animate';
import {
	buildMonthGrid,
	buildWeekdayHeadings,
	formatDayKey,
	fromMonthIndex,
	monthStartKey,
	type CalendarDay,
	type DayKey,
} from '@/lib/calendar';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import {
	formatDaysUntilLabel,
	interpolate,
	pickPlural,
} from '@/lib/dictionary';
import {
	formatEventTimeLabel,
	getDaysUntilEvent,
	getTodayKey,
	isEventEnded,
	groupEventsByDay,
} from '@/lib/event-date';
import { resolveHref } from '@/lib/routes';
import { cn, hasArrayValue, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import type { PEventsQueryResult } from 'sanity.types';
import { EventStatusItem } from './EventStatusItem';

type EventListItem = NonNullable<PEventsQueryResult>['eventList'][number];

type EventsCalendarProps = {
	/**
	 * The month on display, as a month index. An integer rather than a
	 * `{year, month}` pair on purpose: the parent rebuilds this prop on every
	 * render (a clock tick a minute), and an object would be a new identity each
	 * time, missing the memos below and rebuilding the whole grid for a
	 * byte-identical result.
	 */
	monthIndex: number;
	/** Every event in the page's range, bucketed by its start day. */
	eventsByDay: ReturnType<typeof groupEventsByDay<EventListItem>>;
	/** The page's single clock — see the note on PageEvents' `currentDate`. */
	currentDate: Date;
	/** The selected day, owned by PageEvents so it survives a view switch. */
	selectedDay: DayKey | null;
	onSelectDay: (day: DayKey) => void;
};

/** A grid cell with everything that depends only on the month and the locale. */
type PreparedDay = CalendarDay & {
	events: EventListItem[];
	/** The day button's accessible name; null when the day has no events. */
	label: string | null;
};

// How many events a day cell shows before it collapses the rest into a count.
// Three is what fits the desktop cell height without the grid growing a
// scrollbar, and what a ~48px mobile cell holds as dots on one line. The rest is
// never hidden — selecting the day lists all of them in the panel beneath, and
// the overflow count says how many that is.
//
// One number for both widths: both subtrees are in the DOM at every width (one
// `lg:hidden`, the other `hidden lg:flex`), so a single slice also resolves each
// event's ended state once instead of once per subtree.
const MAX_EVENTS_PER_DAY = 3;

// Shared by the two shapes a cell takes, so the box a day occupies cannot drift
// between the interactive and the inert one.
const CELL_CLASS =
	'flex min-h-11 flex-col items-center py-1.5 lg:min-h-28 lg:items-start lg:px-1.5';

/**
 * The month-grid view of /events.
 *
 * One interaction model at every width, deliberately: a day cell is a button
 * that selects the day, and the panel below the grid lists that day's events as
 * links. The alternative — chips that are links on desktop, a select-the-day
 * button on mobile — puts both in the DOM at every width and hands screen
 * readers two controls for one thing. So the chips here are labels inside the
 * button, and the panel is the one place an event is opened from.
 *
 * That also decides the mobile design, which is the hard half: cells shrink to
 * dots (a date plus up to three), tapping one fills the panel directly beneath,
 * and the panel is the full row — time, name, venue, status. It is the pattern
 * every phone calendar uses, and it means the small view loses no information,
 * only the space to show it all at once.
 *
 * Only days in the displayed month that HAVE events are focusable. An empty day
 * has nothing to select, and 42 tab stops per month would otherwise stand
 * between a keyboard visitor and the rest of the page.
 */
export function EventsCalendar({
	monthIndex,
	eventsByDay,
	currentDate,
	selectedDay,
	onSelectDay,
}: EventsCalendarProps) {
	const locale = useLocale();
	const t = useTranslations('events');
	const dateFnsLocale = DATE_FNS_LOCALES[locale];
	const panelId = useId();

	// From the date-fns locale, so the English grid starts on Sunday and the
	// Chinese one on Monday without either being written down here.
	const weekStartsOn = dateFnsLocale.options?.weekStartsOn ?? 0;

	// Formatted once per locale, not per render: the seven headings are rendered
	// at two widths each, so this is fourteen Intl-backed formats that never
	// change while the component is mounted.
	const weekdays = useMemo(
		() =>
			buildWeekdayHeadings(weekStartsOn).map((key) => ({
				key,
				narrow: formatDayKey(
					key,
					t.calendar.weekdayNarrowFormat,
					dateFnsLocale
				),
				wide: formatDayKey(key, t.calendar.weekdayFormat, dateFnsLocale),
			})),
		[weekStartsOn, dateFnsLocale, t]
	);

	// One pass builds the grid, attaches each day's events, and formats the
	// accessible names — everything that depends on the month and the locale but
	// not on the clock or the selection. `selectableDays` falls out of the same
	// walk rather than a second flatten-and-filter over the 42 cells.
	const { weeks, selectableDays, monthDays } = useMemo(() => {
		const selectable: DayKey[] = [];
		const inMonth: DayKey[] = [];
		const prepared = buildMonthGrid(
			fromMonthIndex(monthIndex),
			weekStartsOn
		).map((week) =>
			week.map((day): PreparedDay => {
				// Padding days get their real events too. They are VISIBLE dates —
				// a six-week grid always shows a few of the neighbouring month, and
				// blanking them told a visitor scanning that row the day was free
				// while the next month's grid showed a run on it. Selecting one
				// moves the calendar to the month that owns it (see `selectDay`).
				const events = eventsByDay.get(day.key) ?? [];
				if (events.length === 0) return { ...day, events, label: null };
				selectable.push(day.key);
				// Only the displayed month's days are default candidates; a padding
				// day stays clickable but must not be what a month opens on.
				if (day.isCurrentMonth) inMonth.push(day.key);
				return {
					...day,
					events,
					// The visible content is a number and a few chips, so the button
					// names itself explicitly: the date in full, plus how many events
					// are on it.
					label: interpolate(t.calendar.selectDay, {
						day: formatDayKey(day.key, t.calendar.dayFormat, dateFnsLocale),
						events: interpolate(
							pickPlural(t.calendar.eventCount, events.length),
							{ count: events.length }
						),
					}),
				};
			})
		);
		return { weeks: prepared, selectableDays: selectable, monthDays: inMonth };
	}, [monthIndex, weekStartsOn, eventsByDay, dateFnsLocale, t]);

	// In the events' own timezone, not the viewer's: the ring has to land on the
	// cell an event starting at 07:00 Taipei sits in, or it points at the wrong
	// day for anyone whose UTC offset differs.
	const todayKey = getTodayKey(currentDate);

	// Derived rather than reset when the month changes: last month's selection
	// simply stops being selectable and the fallback takes over. Nothing to
	// synchronise, and no frame where the panel shows a day the grid no longer
	// displays.
	//
	// The fallback opens on the next day still to come, not on `monthDays[0]` —
	// that is the month's EARLIEST event, so late in a busy month the calendar
	// opened on a run that finished weeks ago, dimmed and inert. Day keys are
	// zero-padded, so `>=` is a chronological comparison with no Intl work. Only
	// days of the displayed month are candidates: a padding day stays clickable
	// but must not be what the month opens on.
	const activeDay =
		selectedDay && selectableDays.includes(selectedDay)
			? selectedDay
			: monthDays.includes(todayKey)
				? todayKey
				: (monthDays.find((key) => key >= todayKey) ??
					monthDays.at(-1) ??
					null);

	const activeEvents = activeDay ? (eventsByDay.get(activeDay) ?? []) : [];

	const countLabel = (count: number) =>
		interpolate(pickPlural(t.calendar.eventCount, count), { count });

	return (
		<div className="mt-6 lg:mt-10">
			<table className="w-full table-fixed border-collapse">
				<caption className="sr-only">
					{interpolate(t.calendar.gridLabel, {
						month: formatDayKey(
							monthStartKey(fromMonthIndex(monthIndex)),
							t.monthYearFormat,
							dateFnsLocale
						),
					})}
				</caption>
				<thead>
					<tr>
						{weekdays.map((weekday) => (
							<th
								key={weekday.key}
								scope="col"
								className="t-l-2 text-muted-foreground border-foreground/25 border-b pb-2 text-center font-normal uppercase lg:text-left"
							>
								{/* Two widths of the same heading, so a 48px column gets one
								    character and a desktop column gets three. */}
								<span className="lg:hidden">{weekday.narrow}</span>
								<span className="max-lg:hidden">{weekday.wide}</span>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{weeks.map((week) => (
						<tr key={week[0].key}>
							{week.map((day) => (
								<td
									key={day.key}
									className="border-foreground/25 border-b p-0 align-top"
								>
									<DayCell
										day={day}
										isActive={day.key === activeDay}
										// Current-month only: a ring on a greyed padding cell
										// reads as "today is in this month" when it is not.
										isToday={day.isCurrentMonth && day.key === todayKey}
										currentDate={currentDate}
										panelId={panelId}
										onSelect={onSelectDay}
									/>
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>

			{/* The panel is the only place this view opens an event from, and
			    selecting a day replaces it wholesale. Without a live region the
			    change is silent: `aria-pressed` flips on the button and nothing
			    else is announced, so a screen-reader user has no signal that the
			    activation did anything. `polite` rather than `assertive` — it
			    follows a deliberate action, so it should not interrupt.
			    `aria-atomic` so the heading, the count and the day are read as one
			    statement rather than as whichever nodes happened to change. */}
			<div
				id={panelId}
				className="mt-8 lg:mt-12"
				role="region"
				aria-live="polite"
				aria-atomic="true"
				aria-label={t.calendar.dayPanelLabel}
			>
				{activeDay ? (
					<>
						{/* Left-aligned rather than justified: at 1440px a justified count
						    sits a screen-width away from the date it counts. */}
						<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
							<h2 className="t-h-3 uppercase">
								{formatDayKey(
									activeDay,
									t.calendar.dayHeadingFormat,
									dateFnsLocale
								)}
								{activeDay === todayKey && (
									<span className="text-muted-foreground ml-2">
										{t.calendar.today}
									</span>
								)}
							</h2>
							<p className="t-l-2 text-muted-foreground uppercase">
								{countLabel(activeEvents.length)}
							</p>
						</div>
						<ul className="border-foreground/80 mt-4 border-t">
							{activeEvents.map((event, index) => (
								<DayEventRow
									key={event._id}
									event={event}
									index={index}
									currentDate={currentDate}
								/>
							))}
						</ul>
					</>
				) : (
					<p className="py-8 text-center">{t.emptyMonth}</p>
				)}
			</div>
		</div>
	);
}

/**
 * One day in the grid: a button when it has events, inert text when it does not.
 *
 * The two shapes share `CELL_CLASS` so an empty cell occupies exactly the box a
 * selectable one does — the grid's alignment depends on it.
 */
function DayCell({
	day,
	isActive,
	isToday,
	currentDate,
	panelId,
	onSelect,
}: {
	day: PreparedDay;
	isActive: boolean;
	isToday: boolean;
	currentDate: Date;
	panelId: string;
	onSelect: (day: DayKey) => void;
}) {
	const t = useTranslations('events');

	const dayNumber = (
		<span
			className={cn(
				't-b-2 grid size-6 shrink-0 place-items-center rounded-full tabular-nums transition-colors lg:size-5.5',
				!day.isCurrentMonth && 'text-foreground/25',
				isToday &&
					!isActive &&
					'ring-foreground/60 font-bold ring-1 ring-inset',
				isActive && 'bg-foreground text-background font-bold'
			)}
		>
			{day.day}
		</span>
	);

	if (day.events.length === 0) {
		return <div className={CELL_CLASS}>{dayNumber}</div>;
	}

	// Resolved once for both subtrees below, and only for the events either of
	// them can show: `isEventEnded` falls back to an end-of-day instant in the
	// event's timezone, which is two Intl conversions per call.
	const visible = day.events.slice(0, MAX_EVENTS_PER_DAY).map((event) => ({
		event,
		hasEnded: isEventEnded(event.eventDatetime, event.endDatetime, currentDate),
	}));
	const overflow = day.events.length - visible.length;

	return (
		<button
			type="button"
			onClick={() => onSelect(day.key)}
			aria-pressed={isActive}
			aria-controls={panelId}
			aria-label={day.label ?? undefined}
			className={cn(
				CELL_CLASS,
				'hover:bg-foreground/5 w-full cursor-pointer transition-colors',
				OVERLAY_LINK_FOCUS
			)}
		>
			{dayNumber}

			{/* Mobile: density only — plus the count, so a day with twelve events
			    does not look identical to a day with three. */}
			<span className="mt-1 flex h-1.5 items-center justify-center gap-1 lg:hidden">
				{visible.map(({ event, hasEnded }) => (
					<span
						key={event._id}
						className={cn(
							'bg-foreground size-1 rounded-full',
							hasEnded && 'bg-foreground/30'
						)}
					/>
				))}
				{overflow > 0 && (
					<span className="t-l-2 text-muted-foreground leading-none">
						+{overflow}
					</span>
				)}
			</span>

			{/* Desktop: the events themselves. */}
			<span className="mt-1.5 hidden w-full flex-col gap-1 lg:flex">
				{visible.map(({ event, hasEnded }) => (
					<EventChip key={event._id} event={event} hasEnded={hasEnded} />
				))}
				{overflow > 0 && (
					// `text-left` explicitly: this sits inside a <button>, which
					// centres its text by default, and the chips above set their own
					// alignment.
					<span className="t-l-2 text-muted-foreground px-1.5 text-left uppercase">
						{interpolate(t.calendar.moreEvents, { count: overflow })}
					</span>
				)}
			</span>
		</button>
	);
}

/**
 * The start time an event shows, or the reason it has none.
 *
 * One gate for everything that assumes the date is real: a TBA, postponed or
 * cancelled event must not render a time. Shared by the chip and the panel row
 * so the same event cannot show a time in one and its status in the other.
 */
function useEventTimeLabel(event: EventListItem, formatStr: string): string {
	const t = useTranslations('events');
	return formatEventTimeLabel(
		event,
		formatStr,
		t.status,
		DATE_FNS_LOCALES[useLocale()]
	);
}

/**
 * One event inside a desktop day cell: start time and the codex.
 *
 * The codex (`title`) rather than the human name (`subtitle`) because that is
 * what the list view's first column shows, and the two views sit behind one
 * toggle on one page — a chip leading with a different string than the row it
 * turns into reads as different data. The full name is one click away in the
 * panel, and the day button's accessible name carries the count.
 *
 * Uncoloured on purpose: the authored status colours belong to the pills, which
 * the panel renders. Repeating them here would make a month of chips into a
 * colour chart nobody has a legend for.
 */
function EventChip({
	event,
	hasEnded,
}: {
	event: EventListItem;
	hasEnded: boolean;
}) {
	const t = useTranslations('events');
	const timeLabel = useEventTimeLabel(event, t.calendar.timeFormat);

	return (
		<span
			className={cn(
				't-b-2 bg-foreground/10 flex w-full items-baseline gap-1 truncate rounded-xs px-1.5 py-1 text-left uppercase',
				hasEnded && 'opacity-30'
			)}
		>
			<span className="text-muted-foreground shrink-0 tabular-nums">
				{timeLabel}
			</span>
			<span className="truncate">{event.title}</span>
		</span>
	);
}

/**
 * One event in the day panel — the calendar's equivalent of a list row, and the
 * only place in this view an event is opened from.
 *
 * Mirrors the list's semantics rather than inventing its own: an ended event is
 * dimmed and inert, a date that is not `confirmed` shows its status instead of a
 * time, and the venue keeps its own map link above the row's stretched link.
 */
function DayEventRow({
	event,
	index,
	currentDate,
}: {
	event: EventListItem;
	index: number;
	currentDate: Date;
}) {
	const locale = useLocale();
	const t = useTranslations('events');
	const timeLabel = useEventTimeLabel(event, t.calendar.timeFormat);

	const {
		title,
		subtitle,
		slug,
		statusList,
		eventDatetime,
		endDatetime,
		location,
		locationLink,
		locationRef,
	} = event;

	const displayLocation = locationRef?.name || location;
	const displayLocationLink = locationRef?.mapLink || locationLink;
	const hasEnded = isEventEnded(eventDatetime, endDatetime, currentDate);
	const daysUntil = getDaysUntilEvent(eventDatetime, currentDate);
	// Through the route table rather than a hand-built path, so the event route
	// lives in exactly one place.
	const href = slug
		? resolveHref({ documentType: 'pEvent', slug, locale })
		: null;

	return (
		<li
			className={cn(
				'reveal border-foreground/25 group relative flex flex-col gap-2 border-b py-4',
				hasEnded && 'pointer-events-none'
			)}
			style={revealStagger(index)}
		>
			<div
				className={cn(
					'flex flex-wrap items-baseline gap-x-3 gap-y-1',
					hasEnded && 'opacity-30'
				)}
			>
				<p className="t-b-1 text-muted-foreground shrink-0 tabular-nums uppercase">
					{timeLabel}
				</p>
				<p className="t-b-1 font-bold text-balance uppercase">{title}</p>
				{subtitle && (
					<p className="t-b-1 text-muted-foreground text-balance">{subtitle}</p>
				)}
			</div>

			{displayLocation && (
				<p
					className={cn(
						't-b-2 group/location uppercase',
						hasEnded && 'opacity-30'
					)}
				>
					{displayLocationLink ? (
						<CustomLink
							// Above the row's stretched link so the venue stays separately
							// clickable, the same layering the events strip uses.
							className={cn(
								'relative z-10 inline-flex items-center gap-1',
								OVERLAY_LINK_FOCUS
							)}
							link={{ href: displayLocationLink, isNewTab: true }}
							aria-label={interpolate(t.aria.viewLocation, {
								location: displayLocation || '',
							})}
						>
							{displayLocation}
							<span className="inline-block transition-transform group-hover/location:translate-x-0.5 group-hover/location:-translate-y-0.5">
								<ArrowUpRight className="size-2 inline-block" />
							</span>
						</CustomLink>
					) : (
						displayLocation
					)}
				</p>
			)}

			{(hasArrayValue(statusList) || hasEnded || daysUntil !== null) && (
				<span className="relative z-10 flex flex-wrap gap-1">
					{/* Same cue, same window and same wording as the list row: an event
					    two days out cannot say "in 2 days" in one view and nothing in
					    the other, on one page behind one toggle. */}
					{!hasEnded && daysUntil !== null && (
						<EventStatusItem
							data={{
								eventStatus: { title: formatDaysUntilLabel(daysUntil, t) },
							}}
						/>
					)}
					{hasArrayValue(statusList) &&
						statusList.map((item) => (
							<EventStatusItem
								key={item._key}
								data={item}
								className={cn(hasEnded && 'opacity-30')}
							/>
						))}
					{hasEnded && (
						<EventStatusItem
							data={{ eventStatus: { title: t.status.ended } }}
						/>
					)}
				</span>
			)}

			{href && (
				<Link
					className={cn('p-fill z-0', OVERLAY_LINK_FOCUS)}
					href={href}
					aria-label={interpolate(t.aria.viewEvent, { title: title || '' })}
				/>
			)}
		</li>
	);
}
