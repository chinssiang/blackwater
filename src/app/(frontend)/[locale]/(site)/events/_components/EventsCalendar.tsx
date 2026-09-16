'use client';

import {
	type ElementType,
	type ReactNode,
	useId,
	useMemo,
	useRef,
	useState,
} from 'react';
import Link from 'next/link';
import { EASE_OUT_EXPO, REVEAL_SOFT } from '@/lib/animate';
import {
	type CalendarDay,
	type DayKey,
	buildMonthGrid,
	buildWeekdayHeadings,
	formatDayKey,
	fromMonthIndex,
	monthStartKey,
} from '@/lib/calendar';
import { DATE_FNS_LOCALES } from '@/lib/dateFnsLocale';
import {
	formatDaysUntilLabel,
	interpolate,
	pickPlural,
} from '@/lib/dictionary';
import {
	getDaysUntilEvent,
	getEventEndInstant,
	getTodayKey,
	groupEventsByDay,
	isEventEnded,
	resolveEventTimeLabel,
} from '@/lib/event-date';
import { resolveEventLocation } from '@/lib/event-location';
import { resolveHref } from '@/lib/routes';
import { OVERLAY_LINK_FOCUS, cn, hasArrayValue } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import CustomLink from '@/components/CustomLink';
import EventStatusPill from '@/components/EventStatusPill';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverTitle,
	PopoverTrigger,
} from '@/components/Popover';
import { ArrowUpRight, CloseIcon } from '@/components/SvgIcons';
import { motion } from 'motion/react';
import type { PEventsQueryResult } from 'sanity.types';

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
	/** Capped at what a cell can show; `allEvents` is everything the day holds. */
	events: PreparedEvent[];
	/**
	 * The day's FULL list — what the popover and the panel both open. `events`
	 * above is the capped slice the cell's chips render; a detail view showing
	 * three of twelve would contradict its own count.
	 */
	allEvents: EventListItem[];
	/** The day button's accessible name; null when the day has no events. */
	label: string | null;
};

/**
 * One event with everything a chip needs that does NOT depend on the clock: its
 * end instant, and the start time it displays.
 *
 * Both are functions of the event and the locale alone, and both are Intl-backed
 * — the end-of-day fallback most events take costs two conversions, and
 * `formatRichDate` a third. Resolving them with the grid means a clock wake-up
 * costs one numeric comparison per visible event instead of re-deriving strings
 * that cannot have changed.
 */
type PreparedEvent = {
	event: EventListItem;
	endsAt: number | null;
	/** The start time, or the status word standing in for it. */
	timeLabel: string;
};

// How many events a day cell shows before it collapses the rest into a count.
// Three is what fits the desktop cell height without the grid growing a
// scrollbar, and what a ~48px mobile cell holds as dots on one line. The rest is
// never hidden — opening the day lists all of them, in the popover above `lg`
// and in the panel beneath the grid below it, and the overflow count says how
// many that is.
//
// One number for both widths: both subtrees are in the DOM at every width (one
// `lg:hidden`, the other `hidden lg:flex`), so a single slice also resolves each
// event's ended state once instead of once per subtree.
const MAX_EVENTS_PER_DAY = 3;

// Shared by the two shapes a cell takes, so the box a day occupies cannot drift
// between the interactive and the inert one.
const CELL_CLASS =
	'flex min-h-11 flex-col items-center py-1.5 lg:min-h-28 lg:items-start lg:px-1.5';

// `lg` as Tailwind writes it — 64rem, not 1024px. The panel below the grid is
// hidden with `lg:hidden`, so a px query here would put the JS branch and the
// CSS one on opposite sides of the line for anyone whose browser font size is
// not 16px, and a visitor could end up with neither the panel nor the popover.
const DESKTOP_QUERY = '(min-width: 64rem)';

// How far the incoming month starts off-centre, and how it settles. A nudge
// rather than a full-width push: the outgoing month cannot stay mounted (see
// the note on the `<tbody>` key below), so a grid travelling its own width
// would leave the space it came from empty for most of the animation. 40px
// beside the fade is enough to say WHICH WAY the month moved, which is the
// whole point of the direction, and it matches the site's other entrances
// (rows rise 12px, arrows nudge 2px) rather than announcing itself.
const MONTH_SLIDE_DISTANCE = 40;
const MONTH_SLIDE_DURATION = 0.35;

/**
 * The month-grid view of /events.
 *
 * TWO interaction models, split at `lg` — a reversal of what this comment used
 * to argue, forced by geometry rather than taste. On desktop the grid is six
 * rows of `min-h-28`, so a panel below the grid landed up to ~700px beneath the
 * cell that was clicked, usually off-screen: the click appeared to do nothing.
 * So above `lg` a day cell is a popover trigger and its events open anchored to
 * the cell, and below `lg` the cell stays a button that fills the panel beneath
 * the grid — the pattern every phone calendar uses, and the harder half of the
 * design: cells shrink to a date plus dots, tapping one fills the panel directly
 * beneath, and the panel is the full row (time, name, venue, status), so the
 * small view loses no information, only the space to show it all at once.
 *
 * What this is NOT is the alternative the old note rejected — chips that are
 * links on desktop and a select-the-day button on mobile. The chips are still
 * labels inside the control, each day is still exactly ONE control at every
 * width, and `DayEventRow` is still the only place this view opens an event
 * from; both branches render it.
 *
 * The costs of the split, paid deliberately:
 *
 * - One media query in JS (`useMediaQuery`). CSS cannot make this choice: a
 *   portalled popup hidden with `max-lg:hidden` still opens on tap and still
 *   moves focus into an invisible dialog.
 * - Every route under `[locale]` is prerendered, so the built HTML always
 *   carries the MOBILE branch (`getServerSnapshot` is `false`) and a desktop
 *   client swaps the cells after hydration. Nothing VISUAL differs across that
 *   swap — which is true only because this view now lands with nothing selected
 *   and nothing open (see `activeDay`), and is why `cellClass`/`cellContent` in
 *   `DayCell` are built once and handed to whichever control wraps them. What
 *   does differ is the cell's a11y contract: `aria-pressed` + `aria-controls`
 *   on the panel button versus Base UI's `aria-expanded` + `aria-haspopup` on
 *   the trigger, and the button element itself is recreated once, right after
 *   hydration.
 * - The panel stays in the DOM at every width behind `lg:hidden` rather than
 *   being gated on the same query: pure CSS is correctly hidden from the first
 *   paint with no JS, where a JS gate would flash the "select a day" prompt on
 *   a desktop first paint. `display: none` also takes it out of the a11y tree,
 *   so the hidden panel is neither focusable nor announced.
 * - Two null states instead of one, because "nothing is selected" and "this
 *   month has no events" are different facts (`selectDayPrompt`/`emptyMonth`).
 * - The two branches diverge in STATE, which is the subtle part: the panel
 *   branch calls `onSelectDay`, and `selectDay` in `PageEvents` moves the
 *   calendar to a padding day's own month. A popover cannot afford that — the
 *   month change re-renders the grid and moves or destroys the anchor the popup
 *   is positioned against — so a desktop click writes no `selectedDay` at all
 *   and the trigger's own open state is the whole of it. Consequence, accepted:
 *   a visitor who picks a day on a phone and then widens past `lg` loses the
 *   highlight, because the panel is hidden and no popover was ever opened.
 *
 * Only days that HAVE events are focusable — including the padding days a
 * six-week grid always shows, which are real dates and keep their events. An
 * empty day has nothing to open, and 42 tab stops per month would otherwise
 * stand between a keyboard visitor and the rest of the page.
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
	// See the note at the top of this file: `false` on the server and through
	// hydration, so the prerendered HTML always carries the panel branch.
	const isDesktop = useMediaQuery(DESKTOP_QUERY);
	// Not Motion's `useReducedMotion`: that reads the preference once into state
	// and never re-renders when it changes, so a visitor who turns the setting on
	// mid-session would keep sliding for the rest of it.
	const prefersReducedMotion = usePrefersReducedMotion();

	// Which way the grid travels, derived from the month DELTA rather than passed
	// down from whichever control moved it. React's documented "adjusting state
	// when a prop changes" recipe, and the delta is the only honest source: the
	// arrows are not the sole writer of the month. `selectDay` in `PageEvents`
	// moves it when a phone visitor taps a padding cell belonging to another
	// month, and the list view's arrows jump to the next month that HAS events,
	// which can be several months at once. A `direction` prop threaded from the
	// buttons would be absent in the first case and a step of 1 in the second.
	//
	// It starts at 0, so the mount that puts this view on screen fades without
	// moving — there is no month it came from. The same holds after a view
	// switch, since the list branch unmounts the calendar outright.
	const [previousMonthIndex, setPreviousMonthIndex] = useState(monthIndex);
	const [slideDirection, setSlideDirection] = useState(0);
	if (previousMonthIndex !== monthIndex) {
		setPreviousMonthIndex(monthIndex);
		setSlideDirection(Math.sign(monthIndex - previousMonthIndex));
	}

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
	// not on the clock or the selection. `monthDays` falls out of the same walk
	// rather than a second flatten-and-filter over the 42 cells.
	const { weeks, monthDays } = useMemo(() => {
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
				const dayEvents = eventsByDay.get(day.key) ?? [];
				const events: PreparedEvent[] = dayEvents
					.slice(0, MAX_EVENTS_PER_DAY)
					.map((event) => ({
						event,
						endsAt:
							getEventEndInstant(
								event.eventDatetime,
								event.endDatetime
							)?.getTime() ?? null,
						timeLabel: resolveEventTimeLabel(
							event,
							t.calendar.timeFormat,
							t,
							dateFnsLocale
						).label,
					}));
				if (dayEvents.length === 0) {
					return { ...day, events, allEvents: dayEvents, label: null };
				}
				// A padding day stays clickable, but it is never a candidate for
				// what this month opens on OR stays on — see `activeDay`.
				if (day.isCurrentMonth) inMonth.push(day.key);
				return {
					...day,
					events,
					allEvents: dayEvents,
					// The visible content is a number and a few chips, so the button
					// names itself explicitly: the date in full, plus how many events
					// are on it.
					label: interpolate(t.calendar.selectDay, {
						day: formatDayKey(day.key, t.calendar.dayFormat, dateFnsLocale),
						events: interpolate(
							pickPlural(t.calendar.eventCount, dayEvents.length),
							{ count: dayEvents.length }
						),
					}),
				};
			})
		);
		return { weeks: prepared, monthDays: inMonth };
	}, [monthIndex, weekStartsOn, eventsByDay, dateFnsLocale, t]);

	// In the events' own timezone, not the viewer's: the ring has to land on the
	// cell an event starting at 07:00 Taipei sits in, or it points at the wrong
	// day for anyone whose UTC offset differs.
	const todayKey = getTodayKey(currentDate);

	// Derived rather than reset when the month changes, so there is no frame
	// where the panel shows a day the grid no longer displays.
	//
	// Tested against `monthDays`, NOT every selectable day: adjacent six-week
	// grids overlap by up to ten days, so a selection made in one month is often
	// still ON SCREEN as a padding cell of the next. Accepting it there left the
	// header reading OCTOBER while the panel headed SEPTEMBER 30 and the active
	// fill sat on a greyed padding cell — exactly the state `selectDay` in
	// `PageEvents` exists to prevent, re-entered through the month arrows.
	//
	// There is deliberately NO fallback to a default day. Nothing anchored may
	// open by itself — a popover appearing unasked covers the grid the visitor
	// just navigated to — and a prerendered default would have to be un-painted
	// after hydration, since the built HTML always carries the panel branch. So
	// this view lands with nothing selected, and `selectDayPrompt` says so.
	const activeDay =
		selectedDay && monthDays.includes(selectedDay) ? selectedDay : null;

	// The MONTH's own events, not the grid's: `monthDays` holds current-month
	// days only, so a padding cell carrying next month's run cannot make an empty
	// September claim to have something on it.
	const monthHasEvents = monthDays.length > 0;

	return (
		// `overflow-x-clip` for the month transition below: a grid entering 40px
		// off-centre widens the document and grows a horizontal scrollbar for the
		// length of the animation. `clip` rather than `hidden` because `hidden` on
		// one axis forces the other to `auto`, which would make this a scroll
		// container. Nothing legitimate overflows here: the desktop day popup is
		// portalled out of this subtree, and a cell's focus ring is `ring-inset`,
		// so neither can be trimmed at the grid's edges.
		<div className="mt-6 overflow-x-clip lg:mt-10">
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
				{/* Keyed on the month so a step remounts every cell. Adjacent
				    six-week grids SHARE week keys — for a Sunday start, September
				    2026 runs 08-30…10-04 and October runs 09-27…11-01, so 09-27 and
				    10-04 are `<tr>` keys in both — and React then reuses those rows
				    and their overlapping `<td key="2026-09-30">`. The `Popover.Root`
				    inside is never unmounted, so an open popup survived the step and
				    sat on a greyed padding cell while the header read OCTOBER: the
				    exact state `activeDay` guards the panel against, re-entered
				    through a different door.

				    That remount is also what animates the step, so the month
				    transition below is enter-only and needs no `AnimatePresence`:
				    the outgoing month must NOT be kept around, both because two
				    `<tbody>` elements cannot overlap (they stack) and because
				    keeping one mounted is the reused-cell bug in the paragraph
				    above. The grid is always six weeks tall, so nothing here has to
				    animate a height. */}
				<motion.tbody
					key={monthIndex}
					initial={{
						x: prefersReducedMotion ? 0 : slideDirection * MONTH_SLIDE_DISTANCE,
						opacity: 0,
					}}
					animate={{ x: 0, opacity: 1 }}
					transition={{
						duration: MONTH_SLIDE_DURATION,
						ease: EASE_OUT_EXPO,
					}}
				>
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
										todayKey={todayKey}
										currentDate={currentDate}
										panelId={panelId}
										isDesktop={isDesktop}
										onSelect={onSelectDay}
									/>
								</td>
							))}
						</tr>
					))}
				</motion.tbody>
			</table>

			{/* The panel is where the sub-`lg` branch opens an event from, and
			    selecting a day replaces it wholesale. Without a live region the
			    change is silent: `aria-pressed` flips on the button and nothing
			    else is announced, so a screen-reader user has no signal that the
			    activation did anything. `polite` rather than `assertive` — it
			    follows a deliberate action, so it should not interrupt.
			    `aria-atomic` so the heading, the count and the day are read as one
			    statement rather than as whichever nodes happened to change. Above
			    `lg` the content below is `display: none`, which takes it out of
			    the a11y tree entirely — the popover carries its own name and needs
			    no announcement channel. The region keeps `id={panelId}` at every
			    width so the panel branch's `aria-controls` always resolves; it
			    carries no margin of its own, so on desktop it contributes no
			    height. */}
			<div
				id={panelId}
				role="region"
				aria-live="polite"
				aria-atomic="true"
				aria-label={t.calendar.dayPanelLabel}
			>
				{!monthHasEvents ? (
					// Deliberately NOT inside the `lg:hidden` wrapper below: the panel
					// is a phone affordance, but "this month is empty" is a fact the
					// desktop grid has to state too — hidden here, a month of inert
					// cells says nothing at all.
					<p className="mt-8 py-8 text-center lg:mt-12">{t.emptyMonth}</p>
				) : (
					<div
						key={activeDay ?? 'prompt'}
						className="reveal mt-8 lg:hidden"
						style={REVEAL_SOFT}
					>
						{activeDay ? (
							<DayDetail
								dayKey={activeDay}
								events={eventsByDay.get(activeDay) ?? []}
								isToday={activeDay === todayKey}
								currentDate={currentDate}
							/>
						) : (
							// Not `emptyMonth`: this month HAS events, none is picked.
							<p className="py-8 text-center">{t.calendar.selectDayPrompt}</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

function DayDetail({
	dayKey,
	events,
	isToday,
	currentDate,
	heading: Heading = 'h2',
	action,
}: {
	dayKey: DayKey;
	events: EventListItem[];
	isToday: boolean;
	currentDate: Date;
	heading?: ElementType;
	action?: ReactNode;
}) {
	const locale = useLocale();
	const t = useTranslations('events');
	const dateFnsLocale = DATE_FNS_LOCALES[locale];

	return (
		<>
			<div className="flex shrink-0 items-start justify-between gap-4">
				<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 p-2">
					<Heading className="t-h-3 uppercase">
						{formatDayKey(dayKey, t.calendar.dayHeadingFormat, dateFnsLocale)}
						{isToday && (
							<span className="text-muted-foreground ml-2">
								{t.calendar.today}
							</span>
						)}
					</Heading>
					<p className="t-l-2 text-muted-foreground uppercase">
						{interpolate(pickPlural(t.calendar.eventCount, events.length), {
							count: events.length,
						})}
					</p>
				</div>
				{action}
			</div>
			<ul className="border-foreground/80 mt-4 min-h-0 overflow-y-auto border-t">
				{events.map((event) => (
					<DayEventRow
						key={event._id}
						event={event}
						currentDate={currentDate}
					/>
				))}
			</ul>
		</>
	);
}

/**
 * One day in the grid: a control when it has events, inert text when it does
 * not. Which control depends on the width — a popover trigger above `lg`, a
 * panel button below it. See the split's rationale at the top of this file.
 *
 * All three shapes share `CELL_CLASS` so an empty cell occupies exactly the box
 * a selectable one does — the grid's alignment depends on it.
 */
function DayCell({
	day,
	isActive,
	todayKey,
	currentDate,
	panelId,
	isDesktop,
	onSelect,
}: {
	day: PreparedDay;
	isActive: boolean;
	todayKey: DayKey;
	currentDate: Date;
	panelId: string;
	isDesktop: boolean;
	onSelect: (day: DayKey) => void;
}) {
	const t = useTranslations('events');
	// Focus the popup itself. Base UI's default resolves to the first tabbable
	// INSIDE it — here the first event's stretched link — so opening a day drew
	// a focus ring across one whole row and announced that link instead of the
	// day the popup is named after. (Base UI already does this for touch.)
	const popupRef = useRef<HTMLDivElement>(null);
	// The cell needs both "is today" and "is today AND in this month" now, so it
	// takes the key and answers both rather than being handed two booleans.
	const isToday = day.key === todayKey;

	const dayNumber = (
		<span
			className={cn(
				't-b-2 grid size-6 shrink-0 place-items-center rounded-full tabular-nums transition-[color,background-color,box-shadow] lg:size-5.5',
				!day.isCurrentMonth && 'text-foreground/25',
				// Current-month only: a ring on a greyed padding cell reads as
				// "today is in this month" when it is not. It now sits UNDER both
				// fills instead of switching off beneath them — `ring-foreground/60`
				// over `bg-foreground` is the same ink at 60% and disappears on its
				// own, so neither fill has to know the other's condition.
				isToday &&
					day.isCurrentMonth &&
					'ring-foreground/60 font-bold ring-1 ring-inset',
				// The panel branch's fill, scoped to the widths that HAVE a panel:
				// `selectedDay` survives a resize past `lg`, and an unscoped fill
				// would then paint a desktop cell whose popover is shut and whose
				// panel is hidden.
				isActive &&
					'max-lg:bg-foreground max-lg:text-background max-lg:font-bold',
				// The popover branch's fill, read off the trigger's own state
				// attribute rather than a second copy of "which day is open". The
				// attribute exists only where a trigger does, so it needs no `lg:`
				// and cannot disagree with what is on screen.
				//
				// `data-popup-open` is a BARE attribute, so it is spelled without
				// brackets — the same form `Popover.tsx` uses for `data-open:`,
				// which reserves brackets for key=value (`data-[side=bottom]:`).
				// Bracketed here, Tailwind emitted no rule at all and the open day
				// simply never filled: no error, no warning, nothing in the sheet.
				'group-data-popup-open/day:bg-foreground group-data-popup-open/day:text-background group-data-popup-open/day:font-bold'
			)}
		>
			{day.day}
		</span>
	);

	if (day.allEvents.length === 0) {
		return <div className={CELL_CLASS}>{dayNumber}</div>;
	}

	// `endsAt` and `timeLabel` came with the grid — see `PreparedEvent` — so a
	// clock wake-up costs one numeric comparison per visible event.
	const now = currentDate.getTime();
	const visible = day.events.map(({ event, endsAt, timeLabel }) => ({
		event,
		timeLabel,
		hasEnded: endsAt !== null && endsAt < now,
	}));
	const overflow = day.allEvents.length - visible.length;

	// Built once and handed to whichever control wraps it: the two branches have
	// to be pixel-identical, because the prerender bakes one and a desktop client
	// swaps to the other right after hydration. Same reason `CELL_CLASS` exists.
	const cellClass = cn(
		CELL_CLASS,
		'group/day hover:bg-foreground/5 w-full cursor-pointer transition-[color,background-color,box-shadow]',
		OVERLAY_LINK_FOCUS
	);
	const cellContent = (
		<>
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
				{visible.map(({ event, timeLabel, hasEnded }) => (
					<EventChip
						key={event._id}
						event={event}
						timeLabel={timeLabel}
						hasEnded={hasEnded}
					/>
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
		</>
	);

	if (!isDesktop) {
		return (
			<button
				type="button"
				onClick={() => onSelect(day.key)}
				aria-pressed={isActive}
				aria-controls={panelId}
				aria-label={day.label ?? undefined}
				className={cellClass}
			>
				{cellContent}
			</button>
		);
	}

	return (
		// Uncontrolled, and one Root per day rather than one shared popover with
		// detached triggers (Base UI's `createHandle`): this way the desktop branch
		// holds NO state at all — which day is open is the trigger's own business,
		// and it dies with the cell when the month remounts. No `aria-pressed`
		// beside Base UI's `aria-expanded` either; one control cannot be both a
		// toggle and a disclosure. `openOnHover` stays at its `false` default —
		// hover-open would fire continuously while scanning a month.
		<Popover>
			<PopoverTrigger aria-label={day.label ?? undefined} className={cellClass}>
				{cellContent}
			</PopoverTrigger>
			<PopoverContent
				ref={popupRef}
				initialFocus={popupRef}
				align="start"
				sideOffset={6}
				collisionPadding={16}
				className="t-b-1 max-h-[min(26rem,var(--available-height,26rem))] w-88 gap-0 overflow-hidden"
			>
				<DayDetail
					dayKey={day.key}
					events={day.allEvents}
					// Not gated on `isCurrentMonth`, unlike the ring above: a padding
					// cell that IS today is still today, and the heading may say so.
					isToday={isToday}
					currentDate={currentDate}
					heading={PopoverTitle}
					action={
						<PopoverClose
							aria-label={t.calendar.close}
							className={cn(
								'text-muted-foreground hover:text-foreground shrink-0 cursor-pointer rounded-full p-1 transition-colors',
								OVERLAY_LINK_FOCUS
							)}
						>
							<CloseIcon className="size-3" />
						</PopoverClose>
					}
				/>
			</PopoverContent>
		</Popover>
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
	timeLabel,
	hasEnded,
}: {
	event: EventListItem;
	timeLabel: string;
	hasEnded: boolean;
}) {
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

function DayEventRow({
	event,
	currentDate,
}: {
	event: EventListItem;
	currentDate: Date;
}) {
	const locale = useLocale();
	const t = useTranslations('events');
	const { label: timeLabel, isFirm } = resolveEventTimeLabel(
		event,
		t.calendar.timeFormat,
		t,
		DATE_FNS_LOCALES[locale]
	);

	const { title, subtitle, slug, statusList, eventDatetime, endDatetime } =
		event;

	const { name: displayLocation, mapLink: displayLocationLink } =
		resolveEventLocation(event);
	const hasEnded = isEventEnded(eventDatetime, endDatetime, currentDate);
	// Gated on the same firmness as the time label above: a cancelled event two
	// days out must not answer CANCELLED and "in 2 days" in one row.
	const daysUntil = isFirm
		? getDaysUntilEvent(eventDatetime, currentDate)
		: null;
	// Through the route table rather than a hand-built path, so the event route
	// lives in exactly one place.
	const href = slug
		? resolveHref({ documentType: 'pEvent', slug, locale })
		: null;

	return (
		<li
			className={cn(
				'border-foreground/25 relative isolate flex flex-col gap-2 border-b px-2 py-4',
				href ? 'hover:bg-foreground/5 transition-colors' : null,
				hasEnded && 'pointer-events-none'
			)}
		>
			<div
				className={cn(
					'flex flex-wrap items-baseline gap-x-3 gap-y-1',
					hasEnded && 'opacity-30'
				)}
			>
				<p className="t-b-1 text-muted-foreground shrink-0 uppercase tabular-nums">
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
							<span className="inline-block transition-transform duration-300 ease-out group-hover/location:translate-x-0.5 group-hover/location:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/location:translate-x-0 motion-reduce:group-hover/location:translate-y-0">
								<ArrowUpRight className="inline-block size-2" />
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
						<EventStatusPill
							data={{
								eventStatus: { title: formatDaysUntilLabel(daysUntil, t) },
							}}
						/>
					)}
					{hasArrayValue(statusList) &&
						statusList.map((item) => (
							<EventStatusPill
								key={item._key}
								data={item}
								className={cn(hasEnded && 'opacity-30')}
							/>
						))}
					{hasEnded && (
						<EventStatusPill
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
