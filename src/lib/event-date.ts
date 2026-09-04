import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { stegaClean } from '@sanity/client/stega';
import type { Locale } from 'date-fns';
import type { RichDate } from 'sanity.types';
// Type-only, so this stays a leaf at runtime: `calendar.ts` owns the shape of a
// civil date, this file owns which timezone a stored value is read in.
import type { DayKey } from '@/lib/calendar';

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
 * The civil date a `richDate` falls on, in the event's OWN stored timezone.
 *
 * The day-granular sibling of `getRichDateYearMonth` above, and the reduction
 * the calendar grid buckets by. The event's timezone rather than the viewer's
 * is the whole point: an event authored for 07:00 in Taipei belongs on the 5th
 * for everyone looking at it, including a viewer in Los Angeles for whom that
 * instant is still the 4th.
 */
export function getRichDateDayKey(
	value: RichDate | null | undefined
): DayKey | null {
	// Via `getRichDateInstant` so an unparseable `utc` is rejected here rather
	// than thrown out of `formatInTimeZone`.
	const instant = getRichDateInstant(value);
	if (!instant) return null;
	return formatInTimeZone(
		instant,
		value?.timezone || FALLBACK_TIMEZONE,
		'yyyy-MM-dd'
	);
}

/**
 * Today's civil date, in the timezone the events are read in.
 *
 * `now` is a parameter for the same reason it is on `isEventEnded`. The
 * timezone defaults to the club's rather than the viewer's so the calendar's
 * "today" marker lands on the same cell as an event starting at 07:00 Taipei —
 * marking it by the viewer's timezone is exactly the confusion it exists to
 * avoid.
 */
export function getTodayKey(now: Date, timezone = FALLBACK_TIMEZONE): DayKey {
	return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}

/**
 * Events bucketed by the civil day they start on, in input order.
 *
 * Start day only, deliberately: an event with an `endDatetime` days later would
 * otherwise paint a band across the calendar grid, and the multi-day events
 * this has to show are race weekends and training blocks — things a visitor
 * looks up by when they BEGIN. A spanning-bar layout is a different component,
 * not a flag on this one.
 *
 * Input order is preserved (the queries hand us events ascending by start
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
 * The `dateStatus` that overrides an event's start time, or null when the date
 * is firm enough to show one.
 *
 * ONE gate for every surface: a TBA, postponed or cancelled event must not
 * render a time or a countdown, and four components deciding that separately is
 * how the same event ends up described two ways on two pages.
 *
 * `stegaClean` is load-bearing, not defensive — the same rule `SizeChartTable`
 * records: clean wherever a value is COMPARED rather than rendered. `dateStatus`
 * is a discriminator that crosses from GROQ into JS as a string, and
 * `filterDefault`'s denylist covers `status` but not `dateStatus`, so in draft
 * mode Sanity encodes invisible characters into it. A raw `=== 'confirmed'` is
 * then false for every event in the Presentation tool, and each one renders its
 * status word where its start time belongs — silently, and only for editors.
 * (The `eventsBlock` window avoids this class of bug by resolving to a number
 * inside GROQ; this field is authored as a string, so it is cleaned here.)
 */
export function readEventDateStatus(
	dateStatus: string | null | undefined
): string | null {
	const status = stegaClean(dateStatus);
	if (!status || status === 'confirmed') return null;
	return status;
}

/**
 * What an event shows where its start time goes: the formatted time, or the
 * translated reason it has none.
 *
 * Takes the status labels rather than the dictionary so this module stays free
 * of an `en.json` import — the same reason `formatDaysUntilLabel` lives in
 * dictionary.ts instead of here. Pass `t.status`.
 *
 * The label comes from the dictionary, never from `dateStatus` itself: those are
 * the schema's enum tokens (`tba`/`postponed`/`cancelled`), so rendering one raw
 * printed an English word on the Chinese page — and made the `tba` entry
 * unreachable, since a set value is always truthy.
 */
export function formatEventTimeLabel(
	event: {
		eventDatetime?: RichDate | null;
		dateStatus?: string | null;
	},
	formatStr: string,
	statusLabels: Readonly<Record<string, string>> & { tba: string },
	locale?: Locale
): string {
	const status = readEventDateStatus(event.dateStatus);
	if (!status) {
		return event.eventDatetime
			? formatRichDate(event.eventDatetime, formatStr, locale)
			: statusLabels.tba;
	}
	// An unknown token still falls back to TBA rather than rendering blank.
	return statusLabels[status] ?? statusLabels.tba;
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
		getRichDateInstant(endDatetime) ??
		getRichDateEndOfDayInstant(eventDatetime);
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

/**
 * How far ahead an event still earns a "today" / "in N days" cue.
 *
 * Lives here rather than beside either call site: `/events` and the home-page
 * `eventsBlock` both render this cue, and a window that differs between them is
 * the same event described two ways on two pages.
 */
const DAYS_UNTIL_PILL_WINDOW = 3;

/**
 * `getRichDateDaysUntil` narrowed to the pill window: the day count when the
 * event is between today and DAYS_UNTIL_PILL_WINDOW days away, otherwise null.
 * Past events are excluded too, so callers do not have to re-check.
 */
export function getDaysUntilEvent(
	eventDatetime: RichDate | null | undefined,
	currentDate: Date
): number | null {
	const diffDays = getRichDateDaysUntil(eventDatetime, currentDate);
	if (diffDays === null) return null;
	return diffDays >= 0 && diffDays <= DAYS_UNTIL_PILL_WINDOW ? diffDays : null;
}

/** Rendered when an eventsBlock's editor never set a count. */
const DEFAULT_EVENT_LIMIT = 5;

/**
 * The lower bound to pass `upcomingEventsQuery` as `$upcomingFrom`.
 *
 * Day-granular so the Data Cache key rolls over once a day rather than once per
 * request, and set a day EARLY on purpose: it is only a payload guard, and
 * `selectUpcomingEvents` below makes the real cut. The slack keeps a Taipei
 * morning event from being filtered out by a bound resolved in the runtime's
 * timezone, and keeps nothing hinging on a string comparison between two ISO
 * timestamps of differing millisecond precision.
 */
export function getUpcomingFrom(): string {
	const from = new Date();
	from.setDate(from.getDate() - 1);
	from.setHours(0, 0, 0, 0);
	return from.toISOString();
}

/**
 * The events an `eventsBlock` should render: not yet over, inside the chosen
 * window, capped at `limit`.
 *
 * `isEventEnded` rather than a naive start-time comparison is the point — an
 * event with no `endDatetime` stays live until the end of its start day in its
 * own timezone, so a 7am run does not vanish from the page at 7:01am.
 *
 * `windowDays` is resolved in GROQ (see `eventsBlockField`), so a negative or
 * missing value means "all upcoming". The window is counted in whole calendar
 * days via `getRichDateDaysUntil` rather than by subtracting instants, so
 * "next 7 days" means the seven days an attendee standing in the event's
 * timezone would count — inclusive at both ends.
 *
 * Input is GROQ-ordered ascending and both predicates are monotone in that
 * order, so this stops as soon as `limit` rows are collected instead of
 * filtering all of them and discarding the tail.
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
		windowDays,
		limit,
	}: { now: Date; windowDays?: number | null; limit?: number | null }
): T[] {
	if (!events?.length) return [];

	// `?? `, not `||`: a stored 0 means the editor asked for none.
	const cap = limit ?? DEFAULT_EVENT_LIMIT;
	const bounded = typeof windowDays === 'number' && windowDays >= 0;

	const upcoming: T[] = [];
	for (const event of events) {
		if (upcoming.length >= cap) break;
		if (isEventEnded(event.eventDatetime, event.endDatetime, now)) continue;
		if (bounded) {
			const daysUntil = getRichDateDaysUntil(event.eventDatetime, now);
			// An undated event cannot be placed in a window, so a narrowed window
			// excludes it — "all upcoming" still returns it, isEventEnded having
			// already let it through.
			if (daysUntil === null || daysUntil > windowDays) continue;
		}
		upcoming.push(event);
	}
	return upcoming;
}
