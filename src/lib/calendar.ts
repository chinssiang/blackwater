import { formatInTimeZone } from 'date-fns-tz';
import type { Locale as DateFnsLocale } from 'date-fns';
import type { RichDate } from 'sanity.types';
import { getRichDateInstant } from '@/lib/event-date';

/**
 * The month-grid maths behind the /events calendar view.
 *
 * Everything here is pure and takes its "now" as an argument, for the same
 * reason `event-date.ts` does: the page is prerendered hourly, so the server and
 * the browser resolve "today" at different instants and only the caller knows
 * which clock a given render should use.
 *
 * The other rule this module keeps is the one `event-date.ts` sets out at
 * length: a day is a CIVIL date in a named timezone, never a `Date`'s runtime
 * calendar. Every day here is therefore a `yyyy-MM-dd` string, and the grid is
 * built from integer y/m/d arithmetic via `Date.UTC` rather than from local
 * `Date` mutators — so a Taipei event at 07:00 lands on the same cell whether
 * the page renders on a UTC server or in a browser in UTC-7.
 */

/** The timezone the club's calendar is read in when an event carries none. */
const FALLBACK_TIMEZONE = 'Asia/Taipei';

/** A civil date, `yyyy-MM-dd`. The key every day in this module is bucketed by. */
export type DayKey = string;

export type YearMonth = { year: number; month: number };

export type CalendarDay = {
	/** `yyyy-MM-dd` in the calendar's timezone. */
	key: DayKey;
	/** Day of the month, 1-31. */
	day: number;
	/** Whether the cell belongs to the month on display or to a padding week. */
	isCurrentMonth: boolean;
};

/**
 * `YearMonth` as a sortable, comparable scalar. Month is 0-based (matching
 * `Date.getMonth()` and `getRichDateYearMonth`), so a plain `year * 12 + month`
 * is monotone and lets month stepping and range checks be integer arithmetic
 * rather than `Date` juggling.
 */
export function toMonthIndex({ year, month }: YearMonth): number {
	return year * 12 + month;
}

export function fromMonthIndex(index: number): YearMonth {
	return {
		year: Math.floor(index / 12),
		month: index - Math.floor(index / 12) * 12,
	};
}

/** `n` months from `value`, negative to go back. */
export function addMonths(value: YearMonth, n: number): YearMonth {
	return fromMonthIndex(toMonthIndex(value) + n);
}

export function isSameMonth(a: YearMonth, b: YearMonth): boolean {
	return a.year === b.year && a.month === b.month;
}

/** A `yyyy-MM-dd` key from y/m/d parts, zero-padded. `month` is 0-based. */
function dayKeyFromParts(year: number, month: number, day: number): DayKey {
	const mm = String(month + 1).padStart(2, '0');
	const dd = String(day).padStart(2, '0');
	return `${year}-${mm}-${dd}`;
}

/**
 * The civil date a `richDate` falls on, in the event's OWN stored timezone.
 *
 * The event's timezone rather than the viewer's is the whole point: an event
 * authored for 07:00 in Taipei belongs on the 5th of the month for everyone
 * looking at this calendar, including a viewer in Los Angeles for whom that
 * instant is still the 4th.
 */
export function getRichDateDayKey(
	value: RichDate | null | undefined
): DayKey | null {
	if (!value?.utc) return null;
	const instant = getRichDateInstant(value);
	if (!instant) return null;
	return formatInTimeZone(
		instant,
		value.timezone || FALLBACK_TIMEZONE,
		'yyyy-MM-dd'
	);
}

/** The `YearMonth` a day key belongs to. */
export function getDayKeyYearMonth(key: DayKey): YearMonth {
	const [year, month] = key.split('-').map(Number);
	return { year, month: month - 1 };
}

/**
 * Today's civil date in `timezone`, from an absolute instant.
 *
 * Takes the timezone explicitly so the "today" ring is drawn in the same
 * calendar the events are bucketed into. Marking today by the VIEWER's timezone
 * would put the ring on a different cell than the one an event starting at
 * 07:00 Taipei sits in, which is exactly the confusion the ring exists to avoid.
 */
export function getTodayKey(now: Date, timezone = FALLBACK_TIMEZONE): DayKey {
	return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/**
 * The days of the month grid, padded to whole weeks.
 *
 * `weekStartsOn` is the date-fns convention (0 = Sunday … 6 = Saturday) and
 * comes from the active date-fns locale, so the English calendar starts on
 * Sunday and the Chinese one on Monday without either being hard-coded here.
 *
 * Always six rows. A month grid whose height changes with the month makes the
 * next/previous control jump the page under the pointer, and on mobile it moves
 * the agenda below the grid by up to a row's height on every step. The cost is
 * one trailing week of padding in short months, which is what every calendar app
 * pays for the same stability.
 */
const WEEKS_IN_GRID = 6;
const DAYS_IN_WEEK = 7;

export function buildMonthGrid(
	{ year, month }: YearMonth,
	weekStartsOn = 0
): CalendarDay[] {
	// Integer arithmetic in UTC only — no local-timezone mutators, so the grid
	// is identical wherever it is built. Day 0 of the next month is the last day
	// of this one.
	const firstOfMonth = new Date(Date.UTC(year, month, 1));
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const leading =
		(firstOfMonth.getUTCDay() - weekStartsOn + DAYS_IN_WEEK) % DAYS_IN_WEEK;

	const days: CalendarDay[] = [];
	for (let i = 0; i < WEEKS_IN_GRID * DAYS_IN_WEEK; i++) {
		const dayOfMonth = i - leading + 1;
		const cell = new Date(Date.UTC(year, month, dayOfMonth));
		days.push({
			key: dayKeyFromParts(
				cell.getUTCFullYear(),
				cell.getUTCMonth(),
				cell.getUTCDate()
			),
			day: cell.getUTCDate(),
			isCurrentMonth: dayOfMonth >= 1 && dayOfMonth <= daysInMonth,
		});
	}
	return days;
}

/**
 * Render a day key for display, in the calendar's own terms.
 *
 * A `DayKey` is a civil date with no timezone, so it is formatted as UTC
 * midnight IN UTC. Going through plain `format()` instead would resolve the
 * instant in the RUNTIME timezone, which turns 2026-09-05 into the 4th for
 * every viewer west of Greenwich — the same class of bug the day keys exist to
 * prevent, reintroduced at the last step. Every date string this calendar shows
 * comes through here.
 */
export function formatDayKey(
	key: DayKey,
	formatStr: string,
	locale?: DateFnsLocale
): string {
	const [year, month, day] = key.split('-').map(Number);
	return formatInTimeZone(
		new Date(Date.UTC(year, month - 1, day)),
		'UTC',
		formatStr,
		locale ? { locale } : undefined
	);
}

/**
 * The seven weekday headings, as day keys in a known week, ordered from the
 * locale's first day.
 *
 * Keys rather than pre-formatted strings so the caller can render the width it
 * needs (`EEEEE` narrow on mobile, `EEE` above it) from one source of ordering,
 * through the same `formatDayKey` as every other date here. The week itself is
 * arbitrary and used only for its weekdays — 2024-01-07 was a Sunday.
 */
const KNOWN_SUNDAY_UTC = Date.UTC(2024, 0, 7);

export function buildWeekdayHeadings(weekStartsOn = 0): DayKey[] {
	return Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
		const date = new Date(KNOWN_SUNDAY_UTC + (weekStartsOn + i) * 86_400_000);
		return dayKeyFromParts(
			date.getUTCFullYear(),
			date.getUTCMonth(),
			date.getUTCDate()
		);
	});
}

/**
 * Events bucketed by the civil day they start on, in insertion order.
 *
 * Start day only, deliberately: an event with an `endDatetime` days later would
 * otherwise paint a band across the grid, and the two multi-day events this
 * calendar has to show are a race weekend and a training block — things a
 * visitor looks up by when they BEGIN. A spanning-bar layout is a different
 * component, not a flag on this one.
 *
 * Input order is preserved (the query hands us events ascending by start
 * instant), so each day's list reads chronologically without a second sort.
 */
export function groupEventsByDay<T extends { eventDatetime?: RichDate | null }>(
	events: readonly T[] | null | undefined
): Map<DayKey, T[]> {
	const byDay = new Map<DayKey, T[]>();
	for (const event of events || []) {
		const key = getRichDateDayKey(event.eventDatetime);
		if (!key) continue;
		const bucket = byDay.get(key);
		if (bucket) bucket.push(event);
		else byDay.set(key, [event]);
	}
	return byDay;
}

/**
 * The span of months the calendar can page through, as month indices.
 *
 * Derived from the events themselves rather than from an arbitrary window: the
 * page fetches a bounded range (12 months back, everything forward), and paging
 * past either end would show empty grids with no way to know how far the
 * emptiness runs. `now`'s own month is always included, so a calendar with no
 * events near today still opens on a real month rather than on a distant one.
 */
export function getMonthRange<T extends { eventDatetime?: RichDate | null }>(
	events: readonly T[] | null | undefined,
	now: Date,
	timezone = FALLBACK_TIMEZONE
): { min: number; max: number } {
	const current = toMonthIndex(getDayKeyYearMonth(getTodayKey(now, timezone)));
	let min = current;
	let max = current;
	for (const event of events || []) {
		const key = getRichDateDayKey(event.eventDatetime);
		if (!key) continue;
		const index = toMonthIndex(getDayKeyYearMonth(key));
		if (index < min) min = index;
		if (index > max) max = index;
	}
	return { min, max };
}
