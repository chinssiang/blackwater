import { formatInTimeZone } from 'date-fns-tz';
import type { Locale as DateFnsLocale } from 'date-fns';

/**
 * Month-grid geometry for the /events calendar view.
 *
 * Pure calendar coordinates: a `DayKey` (a civil `yyyy-MM-dd` date, carrying no
 * timezone) and a `YearMonth`. Nothing here knows what an event is or which
 * timezone the club runs on — turning a stored `richDate` into one of these
 * coordinates is `event-date.ts`'s job, beside every other rule about the
 * timezone a value was authored in. That line is what keeps the club's fallback
 * timezone defined exactly once: bucketing a day and judging an event ended
 * cannot drift onto different defaults.
 *
 * The arithmetic is deliberately integer y/m/d through `Date.UTC`, never local
 * `Date` mutators, so a grid comes out identical whether it is built on a UTC
 * server or in a browser in UTC-7.
 */

/** A civil date, `yyyy-MM-dd`. The key every day in the calendar is bucketed by. */
export type DayKey = string;

export type YearMonth = { year: number; month: number };

export type CalendarDay = {
	/** `yyyy-MM-dd`. */
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
	const year = Math.floor(index / 12);
	return { year, month: index - year * 12 };
}

/** A `yyyy-MM-dd` key from y/m/d parts, zero-padded. `month` is 0-based. */
function dayKeyFromParts(year: number, month: number, day: number): DayKey {
	const mm = String(month + 1).padStart(2, '0');
	const dd = String(day).padStart(2, '0');
	return `${year}-${mm}-${dd}`;
}

/**
 * The first day of a month, as a key.
 *
 * Exists so no caller has to hand-build a key: the zero-padding is the contract
 * every `DayKey` rests on, and it was being re-implemented in the two views that
 * render a month name.
 */
export function monthStartKey({ year, month }: YearMonth): DayKey {
	return dayKeyFromParts(year, month, 1);
}

/** The `YearMonth` a day key belongs to. */
export function getDayKeyYearMonth(key: DayKey): YearMonth {
	const [year, month] = key.split('-').map(Number);
	return { year, month: month - 1 };
}

/**
 * The month grid, as whole weeks padded from the neighbouring months.
 *
 * `weekStartsOn` is the date-fns convention (0 = Sunday … 6 = Saturday) and
 * comes from the active date-fns locale, so the English calendar starts on
 * Sunday and the Chinese one on Monday without either being hard-coded here.
 *
 * Rows rather than a flat list because rows are the only shape a month is ever
 * rendered in, and returning them here is what keeps `DAYS_IN_WEEK` from
 * escaping into a view that would then hold its own copy of it.
 *
 * Always six rows. A grid whose height changes with the month makes the
 * next/previous control jump the page under the pointer, and on mobile it moves
 * the day panel below the grid by up to a row's height on every step. The cost
 * is one trailing week of padding in short months, which is what every calendar
 * app pays for the same stability.
 */
const WEEKS_IN_GRID = 6;
const DAYS_IN_WEEK = 7;

export function buildMonthGrid(
	{ year, month }: YearMonth,
	weekStartsOn = 0
): CalendarDay[][] {
	// Integer arithmetic in UTC only — no local-timezone mutators, so the grid
	// is identical wherever it is built. Day 0 of the next month is the last day
	// of this one.
	const firstOfMonth = new Date(Date.UTC(year, month, 1));
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const leading =
		(firstOfMonth.getUTCDay() - weekStartsOn + DAYS_IN_WEEK) % DAYS_IN_WEEK;

	const weeks: CalendarDay[][] = [];
	for (let w = 0; w < WEEKS_IN_GRID; w++) {
		const week: CalendarDay[] = [];
		for (let d = 0; d < DAYS_IN_WEEK; d++) {
			const dayOfMonth = w * DAYS_IN_WEEK + d - leading + 1;
			const cell = new Date(Date.UTC(year, month, dayOfMonth));
			week.push({
				key: dayKeyFromParts(
					cell.getUTCFullYear(),
					cell.getUTCMonth(),
					cell.getUTCDate()
				),
				day: cell.getUTCDate(),
				isCurrentMonth: dayOfMonth >= 1 && dayOfMonth <= daysInMonth,
			});
		}
		weeks.push(week);
	}
	return weeks;
}

/**
 * Render a day key for display, in the calendar's own terms.
 *
 * A `DayKey` is a civil date with no timezone, so it is formatted as UTC
 * midnight IN UTC. Going through plain `format()` instead would resolve the
 * instant in the RUNTIME timezone, which turns 2026-09-05 into the 4th for
 * every viewer west of Greenwich — the same class of bug the day keys exist to
 * prevent, reintroduced at the last step. Every date string the calendar shows
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
