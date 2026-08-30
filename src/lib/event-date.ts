import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { Locale } from 'date-fns';
import type { RichDate } from 'sanity.types';

const FALLBACK_TIMEZONE = 'Asia/Taipei';

/**
 * Format a `richDate` value in its own stored timezone, so the editor's
 * intended wall-clock time is shown regardless of the runtime timezone.
 * Returns an empty string when the value has no usable instant.
 */
export function formatRichDate(
	value: RichDate | null | undefined,
	formatStr: string,
	locale?: Locale
): string {
	if (!value?.utc) return '';
	const timezone = value.timezone || FALLBACK_TIMEZONE;
	return formatInTimeZone(
		value.utc,
		timezone,
		formatStr,
		locale ? { locale } : undefined
	);
}

/**
 * The absolute instant of a `richDate` as a `Date` (built from its UTC value).
 * Use for comparisons and ordering — not for display (use `formatRichDate`).
 */
export function getRichDateInstant(
	value: RichDate | null | undefined
): Date | null {
	if (!value?.utc) return null;
	const date = new Date(value.utc);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The year/month of a `richDate` evaluated in its stored timezone, so events
 * near midnight are grouped into the correct local month. Returns `YYYY` and a
 * 0-based month index, matching `Date.getMonth()`.
 */
export function getRichDateYearMonth(
	value: RichDate | null | undefined
): { year: number; month: number } | null {
	if (!value?.utc) return null;
	const timezone = value.timezone || FALLBACK_TIMEZONE;
	const yyyyMM = formatInTimeZone(value.utc, timezone, 'yyyy-MM');
	const [year, month] = yyyyMM.split('-').map(Number);
	return { year, month: month - 1 };
}

/**
 * The last instant of a `richDate`'s day, evaluated in its stored timezone.
 *
 * Do not reach for `date.setHours(23, 59, 59, 999)` here: that mutator resolves
 * against the *runtime* timezone (UTC on the server, the viewer's OS timezone in
 * the browser), which throws away the timezone the editor actually authored in.
 * For a Taipei event that drifts the boundary by the runtime's UTC offset — eight
 * hours late on a UTC server, nine hours early for a viewer in UTC-7.
 */
export function getRichDateEndOfDayInstant(
	value: RichDate | null | undefined
): Date | null {
	// Via `getRichDateInstant` so an unparseable `utc` is rejected here rather
	// than thrown out of `formatInTimeZone` and up through the page render.
	const instant = getRichDateInstant(value);
	if (!instant) return null;
	const timezone = value?.timezone || FALLBACK_TIMEZONE;
	const day = formatInTimeZone(instant, timezone, 'yyyy-MM-dd');
	const date = fromZonedTime(`${day}T23:59:59.999`, timezone);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Whether an event has finished as of `now`.
 *
 * Prefers the authored end time; when the editor left it blank the event stays
 * live until the end of its start day, in the event's own timezone. Both sides of
 * the comparison are absolute instants, so the result does not depend on where
 * the code happens to run.
 *
 * `now` is a parameter rather than an internal `new Date()` so callers can drive
 * it from React state (and so the function stays pure).
 */
export function isEventEnded(
	eventDatetime: RichDate | null | undefined,
	endDatetime: RichDate | null | undefined,
	now: Date
): boolean {
	const end =
		getRichDateInstant(endDatetime) ?? getRichDateEndOfDayInstant(eventDatetime);
	if (!end) return false;
	return end < now;
}

/**
 * Whole calendar days from `now` to a `richDate`, counted in the event's stored
 * timezone: 0 = same day there, 1 = the next day, negative = already past.
 *
 * Both sides are reduced to a civil `yyyy-MM-dd` in that timezone before being
 * diffed, so the answer is the one an attendee standing in that timezone would
 * give. Snapping to midnight with `.setHours(0, 0, 0, 0)` instead would bucket by
 * the *runtime's* calendar date, which puts a late-night Taipei event on the
 * wrong day for anyone whose UTC offset differs (a UTC server included).
 *
 * The final diff goes through `Date.UTC` purely as integer arithmetic on the
 * y/m/d parts — no timezone or DST is involved by the time we get there.
 */
export function getRichDateDaysUntil(
	value: RichDate | null | undefined,
	now: Date
): number | null {
	const instant = getRichDateInstant(value);
	if (!instant) return null;
	const timezone = value?.timezone || FALLBACK_TIMEZONE;
	const toUtcDays = (date: Date) => {
		const [year, month, day] = formatInTimeZone(date, timezone, 'yyyy-MM-dd')
			.split('-')
			.map(Number);
		return Date.UTC(year, month - 1, day);
	};
	return Math.round((toUtcDays(instant) - toUtcDays(now)) / 86_400_000);
}

/** How many days ahead each `eventsBlock` time window reaches. */
const WINDOW_DAYS: Record<string, number> = {
	week: 7,
	month: 30,
};

/** Fallbacks for an eventsBlock whose editor never touched the field. */
const DEFAULT_EVENT_LIMIT = 5;

/**
 * The events an `eventsBlock` should render: not yet over, inside the chosen
 * window, capped at `limit`.
 *
 * This is where "upcoming" is actually decided. The GROQ bound that fetched
 * these is only a coarse payload guard — it compares `eventDatetime.utc` against
 * a day-granular string, which knows nothing about the event's own timezone and
 * nothing about `endDatetime`. Both matter: `isEventEnded` keeps an event with no
 * end time alive until the end of its start day *there*, so a 7am run does not
 * vanish from the home page at 7:01am.
 *
 * The window is counted in whole calendar days via `getRichDateDaysUntil` rather
 * than by subtracting instants, so "next 7 days" means the seven days an attendee
 * standing in the event's timezone would count. Inclusive at both ends: day 0
 * (today) and day 7 are in, day 8 is out.
 *
 * An unrecognised `timeWindow` — including one still carrying stega characters
 * from draft mode if a caller forgets to clean it — falls through to "all
 * upcoming". Erring toward showing more is the safe direction: the alternative
 * is a section that silently disappears.
 *
 * `now` is a parameter rather than an internal `new Date()` for the same reason
 * it is on `isEventEnded` — the function stays pure and testable.
 */
export function selectUpcomingEvents<
	T extends {
		eventDatetime?: RichDate | null;
		endDatetime?: RichDate | null;
	},
>(
	events: readonly T[] | null | undefined,
	{
		now,
		timeWindow,
		limit,
	}: { now: Date; timeWindow?: string | null; limit?: number | null }
): T[] {
	if (!events?.length) return [];

	const windowDays = timeWindow ? WINDOW_DAYS[timeWindow] : undefined;

	const upcoming = events.filter((event) => {
		if (isEventEnded(event.eventDatetime, event.endDatetime, now)) return false;
		if (windowDays === undefined) return true;
		const daysUntil = getRichDateDaysUntil(event.eventDatetime, now);
		// An undated event cannot be placed in a window, so a narrowed window
		// excludes it — it is still returned by "all upcoming", where isEventEnded
		// has already let it through.
		return daysUntil !== null && daysUntil <= windowDays;
	});

	// `?? DEFAULT`, not `|| DEFAULT`: a stored 0 means the editor asked for none.
	return upcoming.slice(0, limit ?? DEFAULT_EVENT_LIMIT);
}
