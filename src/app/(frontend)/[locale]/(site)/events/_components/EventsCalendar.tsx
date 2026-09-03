'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import CustomLink from '@/components/CustomLink';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { ArrowUpRight } from '@/components/SvgIcons';
import { revealStagger } from '@/lib/animate';
import {
	buildMonthGrid,
	buildWeekdayHeadings,
	formatDayKey,
	getTodayKey,
	type CalendarDay,
	type DayKey,
	type YearMonth,
} from '@/lib/calendar';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import { interpolate, pickPlural, type Dictionary } from '@/lib/dictionary';
import { formatRichDate, isEventEnded } from '@/lib/event-date';
import { localizePath, type Locale } from '@/lib/i18n';
import { cn, hasArrayValue, OVERLAY_LINK_FOCUS } from '@/lib/utils';
import type { PEventsQueryResult } from 'sanity.types';
import { EventStatusItem } from './EventStatusItem';

type EventListItem = NonNullable<PEventsQueryResult>['eventList'][number];

type EventsCalendarProps = {
	/** The month on display. Owned by PageEvents, so both views share it. */
	month: YearMonth;
	/** Every event in the page's range, bucketed by its start day. */
	eventsByDay: Map<DayKey, EventListItem[]>;
	/** The page's single clock — see the note on PageEvents' `currentDate`. */
	currentDate: Date;
};

const DAYS_IN_WEEK = 7;

// How many events a desktop cell shows before it collapses the rest into a
// count. Three is what fits in the cell height below without the grid growing a
// scrollbar; the remainder is never hidden, because selecting the day lists all
// of them in the panel underneath.
const MAX_CHIPS_PER_DAY = 3;

// Mobile shows density, not content: at ~48px a cell has room for the date and
// a few dots, and nothing legible beyond that. Capped so a busy day cannot push
// the dots onto a second line and change the row height.
const MAX_DOTS_PER_DAY = 3;

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
	month,
	eventsByDay,
	currentDate,
}: EventsCalendarProps) {
	const locale = useLocale();
	const t = useTranslations('events');
	const dateFnsLocale = DATE_FNS_LOCALES[locale];
	const panelId = useId();

	// From the date-fns locale, so the English grid starts on Sunday and the
	// Chinese one on Monday without either being written down here.
	const weekStartsOn = dateFnsLocale.options?.weekStartsOn ?? 0;

	const weekdays = useMemo(
		() => buildWeekdayHeadings(weekStartsOn),
		[weekStartsOn]
	);

	const weeks = useMemo(() => {
		const days = buildMonthGrid(month, weekStartsOn);
		const rows: CalendarDay[][] = [];
		for (let i = 0; i < days.length; i += DAYS_IN_WEEK) {
			rows.push(days.slice(i, i + DAYS_IN_WEEK));
		}
		return rows;
	}, [month, weekStartsOn]);

	// In the events' own timezone, not the viewer's: the ring has to land on the
	// cell an event starting at 07:00 Taipei sits in, or it points at the wrong
	// day for anyone whose UTC offset differs.
	const todayKey = getTodayKey(currentDate);

	const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);

	// The days of THIS month that can be selected, in order.
	const selectableDays = useMemo(
		() =>
			weeks
				.flat()
				.filter(
					(day) =>
						day.isCurrentMonth && (eventsByDay.get(day.key)?.length ?? 0) > 0
				)
				.map((day) => day.key),
		[weeks, eventsByDay]
	);

	// Derived rather than reset in an effect: when the month changes, last
	// month's selection simply stops being selectable and the fallback takes
	// over. Nothing to synchronise, and no frame where the panel shows a day the
	// grid no longer displays.
	const activeDay =
		selectedDay && selectableDays.includes(selectedDay)
			? selectedDay
			: selectableDays.includes(todayKey)
				? todayKey
				: (selectableDays[0] ?? null);

	const activeEvents = activeDay ? (eventsByDay.get(activeDay) ?? []) : [];

	const monthLabel = formatDayKey(
		`${month.year}-${String(month.month + 1).padStart(2, '0')}-01`,
		t.monthYearFormat,
		dateFnsLocale
	);

	const countLabel = (count: number) =>
		interpolate(pickPlural(t.calendar.eventCount, count), { count });

	return (
		<div className="mt-6 lg:mt-10">
			<table className="w-full table-fixed border-collapse">
				<caption className="sr-only">
					{interpolate(t.calendar.gridLabel, { month: monthLabel })}
				</caption>
				<thead>
					<tr>
						{weekdays.map((key) => (
							<th
								key={key}
								scope="col"
								className="t-l-2 text-muted-foreground border-foreground/25 border-b pb-2 text-center font-normal uppercase lg:text-left"
							>
								{/* Two widths of the same heading, so a 48px column gets one
								    character and a desktop column gets three. */}
								<span className="lg:hidden">
									{formatDayKey(
										key,
										t.calendar.weekdayNarrowFormat,
										dateFnsLocale
									)}
								</span>
								<span className="max-lg:hidden">
									{formatDayKey(key, t.calendar.weekdayFormat, dateFnsLocale)}
								</span>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{weeks.map((week) => (
						<tr key={week[0].key}>
							{week.map((day) => {
								const dayEvents = day.isCurrentMonth
									? (eventsByDay.get(day.key) ?? [])
									: [];
								const isSelectable = dayEvents.length > 0;
								const isActive = day.key === activeDay;
								const isToday = day.key === todayKey;

								const content = (
									<>
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

										{/* Mobile: density only. */}
										{isSelectable && (
											<span className="mt-1 flex h-1.5 items-center justify-center gap-1 lg:hidden">
												{dayEvents.slice(0, MAX_DOTS_PER_DAY).map((event) => (
													<span
														key={event._id}
														className={cn(
															'bg-foreground size-1 rounded-full',
															isEventEnded(
																event.eventDatetime,
																event.endDatetime,
																currentDate
															) && 'bg-foreground/30'
														)}
													/>
												))}
											</span>
										)}

										{/* Desktop: the events themselves. */}
										{isSelectable && (
											<span className="mt-1.5 hidden w-full flex-col gap-1 lg:flex">
												{dayEvents.slice(0, MAX_CHIPS_PER_DAY).map((event) => (
													<EventChip
														key={event._id}
														event={event}
														currentDate={currentDate}
														timeFormat={t.calendar.timeFormat}
														tbaLabel={t.status.tba}
														dateFnsLocale={dateFnsLocale}
													/>
												))}
												{dayEvents.length > MAX_CHIPS_PER_DAY && (
													// `text-left` explicitly: this sits inside a <button>,
													// which centres its text by default, and the chips
													// above set their own alignment.
													<span className="t-l-2 text-muted-foreground px-1.5 text-left uppercase">
														{interpolate(t.calendar.moreEvents, {
															count: dayEvents.length - MAX_CHIPS_PER_DAY,
														})}
													</span>
												)}
											</span>
										)}
									</>
								);

								return (
									<td
										key={day.key}
										className="border-foreground/25 border-b p-0 align-top"
									>
										{isSelectable ? (
											<button
												type="button"
												onClick={() => setSelectedDay(day.key)}
												aria-pressed={isActive}
												aria-controls={panelId}
												// The visible content is a number and a few chips, so
												// the button names itself explicitly — the date in full
												// plus how many events are on it.
												aria-label={interpolate(t.calendar.selectDay, {
													day: formatDayKey(
														day.key,
														t.calendar.dayFormat,
														dateFnsLocale
													),
													events: countLabel(dayEvents.length),
												})}
												className={cn(
													'hover:bg-foreground/5 flex min-h-11 w-full cursor-pointer flex-col items-center py-1.5 transition-colors lg:min-h-28 lg:items-start lg:px-1.5',
													OVERLAY_LINK_FOCUS
												)}
											>
												{content}
											</button>
										) : (
											<div className="flex min-h-11 flex-col items-center py-1.5 lg:min-h-28 lg:items-start lg:px-1.5">
												{content}
											</div>
										)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>

			<div id={panelId} className="mt-8 lg:mt-12">
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
									locale={locale}
									t={t}
									dateFnsLocale={dateFnsLocale}
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
	currentDate,
	timeFormat,
	tbaLabel,
	dateFnsLocale,
}: {
	event: EventListItem;
	currentDate: Date;
	timeFormat: string;
	tbaLabel: string;
	dateFnsLocale: (typeof DATE_FNS_LOCALES)[Locale];
}) {
	const { title, eventDatetime, endDatetime, dateStatus } = event;
	const dateIsFirm = !dateStatus || dateStatus === 'confirmed';
	const hasEnded = isEventEnded(eventDatetime, endDatetime, currentDate);

	return (
		<span
			className={cn(
				't-b-2 bg-foreground/10 flex w-full items-baseline gap-1 truncate rounded-xs px-1.5 py-1 text-left uppercase',
				hasEnded && 'opacity-30'
			)}
		>
			<span className="text-muted-foreground shrink-0 tabular-nums">
				{dateIsFirm && eventDatetime
					? formatRichDate(eventDatetime, timeFormat, dateFnsLocale)
					: dateStatus || tbaLabel}
			</span>
			<span className="truncate">{title}</span>
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
	locale,
	t,
	dateFnsLocale,
}: {
	event: EventListItem;
	index: number;
	currentDate: Date;
	locale: Locale;
	t: Dictionary['events'];
	dateFnsLocale: (typeof DATE_FNS_LOCALES)[Locale];
}) {
	const {
		title,
		subtitle,
		slug,
		statusList,
		eventDatetime,
		endDatetime,
		dateStatus,
		location,
		locationLink,
		locationRef,
	} = event;

	const displayLocation = locationRef?.name || location;
	const displayLocationLink = locationRef?.mapLink || locationLink;
	const dateIsFirm = !dateStatus || dateStatus === 'confirmed';
	const hasEnded = isEventEnded(eventDatetime, endDatetime, currentDate);

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
					{dateIsFirm && eventDatetime
						? formatRichDate(
								eventDatetime,
								t.calendar.timeFormat,
								dateFnsLocale
							)
						: dateStatus || t.status.tba}
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

			{(hasArrayValue(statusList) || hasEnded) && (
				<span className="relative z-10 flex flex-wrap gap-1">
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

			<Link
				className={cn('p-fill z-0', OVERLAY_LINK_FOCUS)}
				href={localizePath(`/events/${slug}`, locale)}
				aria-label={interpolate(t.aria.viewEvent, { title: title || '' })}
			/>
		</li>
	);
}
