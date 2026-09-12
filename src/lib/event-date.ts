import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { stegaClean } from '@sanity/client/stega';
import { resolveEventDateStatus } from './event-status';
import type { Locale } from 'date-fns';
import type { Dictionary } from './dictionary';
import type { RichDate } from 'sanity.types';
// Type-only, so this stays a leaf at runtime: `calendar.ts` owns the shape of a
// civil date, this file owns which timezone a stored value is read in.
import type { DayKey } from '@/lib/calendar';

/**
 * The timezone an event is read in when its stored `richDate` carries none —
 * and, more broadly, the club's own timezone.
 *
 * Exported because it was declared three times: here, in `buildEventName.ts`
 * (which names events for structured data) and as `CREW_TIMEZONE` on the crew
 * page (which buckets months). Three literals meant the day an event is filed
 * under, the day it is judged to have ended, and the day its structured data
 * claims could drift apart on a relocation or a second chapter — silently, and
 * with every test still passing, since each suite passes its own `TZ` in.
 */
export const FALLBACK_TIMEZONE = 'Asia/Taipei';

/**
 * Memoised so the validity probe below is paid once per distinct zone name.
 * Keyed on the CLEANED value on purpose: a stega-encoded string is unique per
 * document per field, so keying on the raw one would grow an entry per event
 * per render in draft mode instead of holding the handful of real names.
 */
const resolvedTimezones = new Map<string, string>();

/**
 * The timezone a stored `richDate` is read in: its own when `Intl` can use it,
 * the club's when it cannot.
 *
 * Two unrelated bad values reach the same `RangeError` out of `Intl`, and every
 * reader below runs during render — so one of them took the whole page to its
 * error boundary rather than degrading the single row it belongs to.
 *
 * DRAFT MODE was the broad cause, and it is now fixed at its source: the stega
 * `filter` in `sanity/lib/client.ts` opts `timezone` out of encoding entirely,
 * so no reader sees an encoded value — and `defineLive` shares that client, so
 * the Presentation tool is covered by the same arm. Before that, `timezone` was
 * not on `filterDefault`'s denylist (which lists `status`), so every event in
 * draft mode carried invisible characters and `/events` hit its error boundary
 * on any dataset.
 *
 * The `stegaClean` below stays as a BACKSTOP rather than the fix. It is one
 * cheap call, and without it a future change to that filter would not crash —
 * it would quietly resolve a Los Angeles event in Taipei, which is the worse of
 * the two failures. That is also why it cleans BEFORE judging validity.
 *
 * The narrow one is a stored value that was never IANA — `GMT+8`, `Taipei`,
 * `UTC+08:00` from a hand-edit or an import. Nothing cheap tells those apart
 * from a valid alias like `Etc/GMT-8` or a bare `UTC`, both of which must keep
 * working, so validity is simply whatever `Intl` accepts.
 */
export function resolveEventTimezone(
	timezone: string | null | undefined
): string {
	const cleaned = stegaClean(timezone);
	if (!cleaned) return FALLBACK_TIMEZONE;

	const cached = resolvedTimezones.get(cleaned);
	if (cached) return cached;

	let resolved = FALLBACK_TIMEZONE;
	try {
		// Constructing one is the only cheap way to ask Intl whether it knows the
		// zone; the instance is discarded.
		new Intl.DateTimeFormat('en-US', { timeZone: cleaned });
		resolved = cleaned;
	} catch {
		// The cache means this reports each bad value once, not once per render.
		if (process.env.NODE_ENV !== 'production') {
			console.warn(
				`[event-date] unusable richDate.timezone ${JSON.stringify(
					cleaned
				)} — reading it in ${FALLBACK_TIMEZONE}`
			);
		}
	}

	resolvedTimezones.set(cleaned, resolved);
	return resolved;
}

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
	const timezone = resolveEventTimezone(value.timezone);
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

/** The fields `resolveEventTimeLabel` reads; every event query result has them. */
type EventTimeLabelInput = {
	dateStatus?: string | null;
	eventDatetime?: RichDate | null;
};

/**
 * The time an event shows, or the reason it has none — plus whether the date was
 * real, because everything else that assumes a date needs the same answer.
 *
 * One gate for everything downstream of "is this date real": a TBA, postponed or
 * cancelled event must not render a time, and a caller that re-derives the two
 * halves separately can pair them wrongly — which is how "CANCELLED" once landed
 * in the time slot beside an "in 2 days" pill on the same row. `isFirm` comes
 * back so a caller gating a countdown reads the same answer the label did.
 *
 * Here rather than in `event-status.ts` even though the gate itself lives there:
 * that module is a deliberate leaf (see its header) and this needs
 * `formatRichDate`, which would give it a `date-fns-tz` dependency. `t` and the
 * date-fns locale are arguments, not context reads, so a caller can resolve a
 * whole month of these inside a memo instead of once per render.
 *
 * `formatStr` stays a parameter because the callers legitimately differ: the
 * calendar renders a time, the list a full date.
 */
export function resolveEventTimeLabel(
	event: EventTimeLabelInput,
	formatStr: string,
	t: Dictionary['events'],
	dateFnsLocale?: Locale
): { label: string; isFirm: boolean } {
	const status = resolveEventDateStatus(event.dateStatus, t);
	return {
		isFirm: status.isFirm,
		label:
			status.isFirm && event.eventDatetime
				? formatRichDate(event.eventDatetime, formatStr, dateFnsLocale)
				: status.label,
	};
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
	const timezone = resolveEventTimezone(value.timezone);
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
		resolveEventTimezone(value?.timezone),
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
 * The instant the next civil day begins in `timezone`, relative to `now`.
 *
 * The other half of what a clock-driven view has to wake up for. An event
 * finishing is one transition; a day rolling over is the other, and it moves
 * `getTodayKey`'s answer and every `getDaysUntilEvent` count with it. Callers
 * ask this once per timezone in PLAY rather than only the club's, because
 * `getRichDateDaysUntil` counts days in the event's own zone — so an event
 * stored elsewhere rolls over on its own schedule.
 *
 * Built like `getRichDateEndOfDayInstant`: read the civil date in the target
 * zone, add a day as integer `Date.UTC` arithmetic so month and year ends carry
 * without a local `Date` mutator, then convert that civil midnight back to an
 * instant IN the zone. The answer is therefore not `now` plus 24 hours less the
 * time of day. `toISOString` is only zero-padding here — the instant it formats
 * is already UTC, so no second timezone conversion is involved.
 *
 * `fromZonedTime` alone is NOT enough to account for DST, which is what the
 * check below is for. A handful of zones put their spring-forward jump ON
 * midnight — America/Havana, Asia/Beirut, America/Santiago — so `00:00` never
 * happens there that day, and `fromZonedTime` resolves the missing time
 * BACKWARDS, to 23:00 on the day before. That is an hour EARLIER than the day it
 * was asked for, and behind `now` for the whole hour after the jump: a caller
 * scheduling from it gets a delay of zero, forever. The first instant that is
 * really on `nextDay` is the jump itself, so bisect for it. Zones whose midnight
 * exists (every zone on every other day) take the early return.
 */
export function getNextDayStartInstant(
	now: Date,
	timezone = FALLBACK_TIMEZONE
): Date {
	const [year, month, day] = getTodayKey(now, timezone).split('-').map(Number);
	const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
		.toISOString()
		.slice(0, 10);
	const candidate = fromZonedTime(`${nextDay}T00:00:00.000`, timezone);
	// Day keys are zero-padded, so this is a chronological comparison.
	if (getTodayKey(candidate, timezone) >= nextDay) return candidate;
	// No recorded jump is anywhere near six hours; the window only has to contain
	// the boundary for the bisection to land on it exactly.
	let before = candidate.getTime();
	let after = before + 6 * 60 * 60 * 1000;
	while (after - before > 1) {
		const mid = before + Math.floor((after - before) / 2);
		if (getTodayKey(new Date(mid), timezone) >= nextDay) after = mid;
		else before = mid;
	}
	return new Date(after);
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
	const timezone = resolveEventTimezone(value?.timezone);
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
	const end = getEventEndInstant(eventDatetime, endDatetime);
	if (!end) return false;
	return end < now;
}

/**
 * The instant an event is over — the authored end time, or the end of its start
 * day in its own timezone.
 *
 * The clock-INDEPENDENT half of `isEventEnded`, split out so a caller rendering
 * many events against a ticking clock can resolve it once instead of once per
 * tick. It is not cheap: the end-of-day fallback (the common case, since most
 * events carry no `endDatetime`) costs two `Intl.DateTimeFormat` conversions,
 * and a calendar month re-running that for every visible event every minute is
 * pure waste — the answer only changes when the event does.
 */
export function getEventEndInstant(
	eventDatetime: RichDate | null | undefined,
	endDatetime: RichDate | null | undefined
): Date | null {
	return (
		getRichDateInstant(endDatetime) ?? getRichDateEndOfDayInstant(eventDatetime)
	);
}

/** Wake-up spacing if the schedule below is ever left with no real transition. */
const FALLBACK_CLOCK_WAIT_MS = 60 * 60 * 1000;

/** The date fields the clock schedule below reads off an event. */
type EventClockInput = {
	eventDatetime?: RichDate | null;
	endDatetime?: RichDate | null;
};

/**
 * The next instant at which what a clock-driven event view renders actually
 * changes: the earliest event still to finish, or the next civil-day rollover.
 *
 * Lives here beside the three readers whose answers flip at those instants —
 * `isEventEnded`, `getDaysUntilEvent` and `getTodayKey` — because knowing WHICH
 * instants they are means knowing which timezone each of them counts in:
 * `getRichDateDaysUntil` counts days in the event's own zone while `getTodayKey`
 * reads in the club's, so the rollover has to be asked of every zone in play. A
 * caller deriving that for itself is a caller depending on this module's
 * internals, and one that would go stale without a single test failing.
 *
 * Each candidate is the first instant its answer DIFFERS, not the boundary
 * itself. `isEventEnded` compares `end < now`, so an event's answer changes at
 * `end + 1`, while `getTodayKey` already reports the new day at midnight
 * exactly. Reporting the boundary for both instead is what made a settling pad
 * necessary: a wake-up landing exactly ON an end instant rendered it as not yet
 * ended and then, because the next scan wants an instant strictly after `now`,
 * dropped that transition entirely and left the row stale until the following
 * day. Answering with the flip instant makes the result strictly greater than
 * `now` by construction, so a caller can re-arm from it with no padding.
 *
 * A rollover always exists and is always ahead of `now`, so the result is
 * always finite — but both are enforced below rather than trusted, because the
 * caller turns this into a `setTimeout` delay: a past instant clamps to a 0ms
 * delay that re-arms on the same past instant, and an `Infinity` coerces to the
 * same thing. Either one spins the page instead of failing loudly.
 */
export function getNextEventClockTransition(
	events: readonly EventClockInput[] | null | undefined,
	now: Date
): number {
	const nowMs = now.getTime();
	const zones = new Set<string>([FALLBACK_TIMEZONE]);
	let next = Infinity;
	for (const event of events || []) {
		zones.add(resolveEventTimezone(event.eventDatetime?.timezone));
		const end = getEventEndInstant(
			event.eventDatetime,
			event.endDatetime
		)?.getTime();
		if (end === undefined) continue;
		const flipsAt = end + 1;
		if (flipsAt > nowMs && flipsAt < next) next = flipsAt;
	}
	for (const zone of zones) {
		const rollover = getNextDayStartInstant(now, zone).getTime();
		if (rollover > nowMs && rollover < next) next = rollover;
	}
	// Unreachable, and cheap to make so. Degrading to an hourly poll costs one
	// wasted render an hour; returning a past instant or an Infinity costs the
	// visitor's battery.
	return Number.isFinite(next) ? next : nowMs + FALLBACK_CLOCK_WAIT_MS;
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
	const timezone = resolveEventTimezone(value?.timezone);
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
