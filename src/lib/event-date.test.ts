import { describe, it, expect } from 'vitest';
import type { RichDate } from 'sanity.types';
import { vercelStegaCombine } from '@vercel/stega';
import { formatInTimeZone } from 'date-fns-tz';
import {
	FALLBACK_TIMEZONE,
	formatRichDate,
	getDaysUntilEvent,
	getNextDayStartInstant,
	getNextEventClockTransition,
	getRichDateDayKey,
	getRichDateInstant,
	getRichDateYearMonth,
	resolveEventTimezone,
	getTodayKey,
	groupEventsByDay,
	isEventEnded,
	selectUpcomingEvents,
} from './event-date';

// Everything is anchored in Asia/Taipei (UTC+8), the timezone the events are
// authored in, and `now` is fixed so the suite does not drift with the clock.
const TZ = 'Asia/Taipei';

/** A richDate at a Taipei wall-clock time, stored the way the plugin stores it. */
function taipei(local: string): RichDate {
	// `local` is "YYYY-MM-DDTHH:mm"; Taipei is UTC+8 year round (no DST).
	return {
		_type: 'richDate',
		local,
		utc: new Date(`${local}:00+08:00`).toISOString(),
		timezone: TZ,
		offset: 480,
	};
}

// 2026-08-30 14:00 in Taipei.
const NOW = new Date('2026-08-30T14:00:00+08:00');

const event = (start: string, end?: string) => ({
	eventDatetime: taipei(start),
	endDatetime: end ? taipei(end) : null,
});

describe('isEventEnded', () => {
	it('keeps an event that started earlier today but has no end time', () => {
		// The trap this guards: a 7am run must not disappear at 7:01am.
		expect(isEventEnded(taipei('2026-08-30T07:00'), null, NOW)).toBe(false);
	});

	it('ends an undated-end event once its start day is over in its timezone', () => {
		expect(isEventEnded(taipei('2026-08-29T07:00'), null, NOW)).toBe(true);
	});

	it('prefers the authored end time over the end-of-day fallback', () => {
		// Started two days ago, still running: not ended.
		expect(
			isEventEnded(taipei('2026-08-28T07:00'), taipei('2026-08-31T18:00'), NOW)
		).toBe(false);
		// Started today, already finished: ended.
		expect(
			isEventEnded(taipei('2026-08-30T07:00'), taipei('2026-08-30T09:00'), NOW)
		).toBe(true);
	});

	it('never ends an event with no usable date', () => {
		expect(isEventEnded(null, null, NOW)).toBe(false);
	});
});

describe('getDaysUntilEvent', () => {
	// Shared by the /events rows and the home-page strip, so the window has to
	// mean the same thing in both places.
	it('counts whole Taipei calendar days, not 24-hour spans', () => {
		// 4 hours later on the clock, but the next calendar day in Taipei.
		expect(getDaysUntilEvent(taipei('2026-08-31T02:00'), NOW)).toBe(1);
	});

	it('reports an event later today as 0', () => {
		expect(getDaysUntilEvent(taipei('2026-08-30T23:00'), NOW)).toBe(0);
	});

	it('includes the far edge of the window', () => {
		expect(getDaysUntilEvent(taipei('2026-09-02T09:00'), NOW)).toBe(3);
	});

	it('returns null beyond the window rather than a count', () => {
		expect(getDaysUntilEvent(taipei('2026-09-03T09:00'), NOW)).toBeNull();
	});

	it('returns null for a past event', () => {
		expect(getDaysUntilEvent(taipei('2026-08-29T09:00'), NOW)).toBeNull();
	});

	it('returns null for an undated event', () => {
		expect(getDaysUntilEvent(null, NOW)).toBeNull();
	});
});

describe('selectUpcomingEvents', () => {
	it('returns nothing for an empty or missing list', () => {
		expect(selectUpcomingEvents(null, { now: NOW })).toEqual([]);
		expect(selectUpcomingEvents([], { now: NOW })).toEqual([]);
	});

	it('drops events that have already ended', () => {
		const past = event('2026-08-01T09:00');
		const today = event('2026-08-30T07:00');
		const soon = event('2026-09-02T09:00');
		expect(
			selectUpcomingEvents([past, today, soon], { now: NOW, windowDays: -1 })
		).toEqual([today, soon]);
	});

	it('counts the week window in whole calendar days, inclusive of day 7', () => {
		const day7 = event('2026-09-06T09:00');
		const day8 = event('2026-09-07T09:00');
		expect(
			selectUpcomingEvents([day7, day8], { now: NOW, windowDays: 7 })
		).toEqual([day7]);
	});

	it('includes an event later today in a narrowed window (day 0)', () => {
		const laterToday = event('2026-08-30T20:00');
		expect(
			selectUpcomingEvents([laterToday], { now: NOW, windowDays: 7 })
		).toEqual([laterToday]);
	});

	it('applies the 30-day month window', () => {
		const inRange = event('2026-09-29T09:00');
		const outOfRange = event('2026-10-05T09:00');
		expect(
			selectUpcomingEvents([inRange, outOfRange], {
				now: NOW,
				windowDays: 30,
			})
		).toEqual([inRange]);
	});

	it('treats a missing or negative window as "all upcoming"', () => {
		// GROQ projects -1 for "all"; a module written through the API may carry
		// neither. Erring toward showing more is the safe direction — the
		// alternative is a section that silently disappears.
		const far = event('2027-06-01T09:00');
		expect(selectUpcomingEvents([far], { now: NOW })).toEqual([far]);
		expect(selectUpcomingEvents([far], { now: NOW, windowDays: -1 })).toEqual([
			far,
		]);
	});

	it('excludes an undated event from a narrowed window but not from "all"', () => {
		const undated = { eventDatetime: null, endDatetime: null };
		expect(
			selectUpcomingEvents([undated], { now: NOW, windowDays: 7 })
		).toEqual([]);
		expect(
			selectUpcomingEvents([undated], { now: NOW, windowDays: -1 })
		).toEqual([undated]);
	});

	it('defaults to five when no limit is stored, and honours a stored zero', () => {
		const many = Array.from({ length: 8 }, (_, i) =>
			event(`2026-09-${String(i + 1).padStart(2, '0')}T09:00`)
		);
		expect(selectUpcomingEvents(many, { now: NOW })).toHaveLength(5);
		expect(selectUpcomingEvents(many, { now: NOW, limit: 3 })).toHaveLength(3);
		// `?? `, not `||` — a stored 0 is an answer, not an absence.
		expect(selectUpcomingEvents(many, { now: NOW, limit: 0 })).toHaveLength(0);
	});
});

/** The same wall-clock time authored in Los Angeles instead. */
function losAngeles(local: string): RichDate {
	return {
		_type: 'richDate',
		local,
		utc: new Date(`${local}:00-07:00`).toISOString(),
		timezone: 'America/Los_Angeles',
		offset: -420,
	};
}

describe('getRichDateDayKey', () => {
	it("buckets by the event's own timezone, not the runtime's", () => {
		// 07:00 Taipei is 23:00 UTC the PREVIOUS day. Bucketing by a runtime
		// calendar would file this run under the 4th on a UTC server.
		expect(getRichDateDayKey(taipei('2026-09-05T07:00'))).toBe('2026-09-05');
	});

	it('keeps a late-night event on its own local date', () => {
		// 23:30 Taipei is 15:30 UTC the same day, so this one only breaks the
		// other way — a viewer in UTC+13 would call it the 6th.
		expect(getRichDateDayKey(taipei('2026-09-05T23:30'))).toBe('2026-09-05');
	});

	it('honours a different stored timezone on the same instant', () => {
		// 2026-09-05T07:00-07:00 is 2026-09-05T22:00 in Taipei: same instant,
		// and each event keeps the civil date it was authored for.
		expect(getRichDateDayKey(losAngeles('2026-09-05T07:00'))).toBe(
			'2026-09-05'
		);
	});

	it('returns null when there is no usable instant', () => {
		expect(getRichDateDayKey(null)).toBeNull();
		expect(getRichDateDayKey({ _type: 'richDate' })).toBeNull();
		expect(
			getRichDateDayKey({ _type: 'richDate', utc: 'not-a-date' })
		).toBeNull();
	});
});

describe('getTodayKey', () => {
	it("resolves today in the events' timezone, not the runtime one", () => {
		// 2026-09-04T20:00 UTC is already the 5th in Taipei.
		expect(getTodayKey(new Date('2026-09-04T20:00:00Z'), TZ)).toBe(
			'2026-09-05'
		);
	});
});

describe('getNextDayStartInstant', () => {
	it("returns the next midnight in the events' timezone, not the runtime one", () => {
		// Already the 5th in Taipei, so the next rollover there is the 6th —
		// 2026-09-05T16:00 UTC, well before the runtime's own next midnight.
		expect(
			getNextDayStartInstant(new Date('2026-09-04T20:00:00Z'), TZ).toISOString()
		).toBe('2026-09-05T16:00:00.000Z');
	});

	it('carries across a month end', () => {
		expect(
			getNextDayStartInstant(new Date('2026-09-30T12:00:00Z'), TZ).toISOString()
		).toBe('2026-09-30T16:00:00.000Z');
	});

	it('carries across a year end', () => {
		// 14:00 on 12-31 in Taipei, so the +1 day is the one that has to carry the
		// year: Date.UTC(2026, 11, 32) normalises to 2027-01-01. Picking a `now`
		// that is already January there would never reach the carry.
		expect(
			getNextDayStartInstant(new Date('2026-12-31T06:00:00Z'), TZ).toISOString()
		).toBe('2026-12-31T16:00:00.000Z');
	});

	it('is 23 hours away on the day a zone springs forward', () => {
		// Los Angeles moves to DST at 02:00 local on 2026-03-08, so that civil day
		// is 23 hours long. Naive "now + 24h" arithmetic would overshoot the
		// rollover by an hour and leave a day-count stale.
		expect(
			getNextDayStartInstant(
				new Date('2026-03-08T08:00:00Z'),
				'America/Los_Angeles'
			).toISOString()
		).toBe('2026-03-09T07:00:00.000Z');
	});

	it('starts the next day at the jump in a zone that skips midnight', () => {
		// America/Havana springs forward 2026-03-08 00:00 -> 01:00, so local
		// midnight never happens. `fromZonedTime` resolves the missing time
		// backwards, to 23:00 on the 7th (2026-03-08T04:00Z) — an hour BEFORE the
		// day it was asked for. The real first instant of the 8th is the jump.
		const next = getNextDayStartInstant(
			new Date('2026-03-07T20:00:00Z'),
			'America/Havana'
		);
		expect(next.toISOString()).toBe('2026-03-08T05:00:00.000Z');
		expect(formatInTimeZone(next, 'America/Havana', 'yyyy-MM-dd HH:mm')).toBe(
			'2026-03-08 01:00'
		);
	});

	it('stays ahead of the clock through a midnight jump', () => {
		// The hour after the jump is where the backwards resolution put the answer
		// behind `now`, which is what a caller re-arming from it cannot survive.
		for (const iso of [
			'2026-03-08T03:59:59.999Z',
			'2026-03-08T04:00:00.000Z',
			'2026-03-08T04:30:00.000Z',
			'2026-03-08T04:59:59.999Z',
		]) {
			const now = new Date(iso);
			expect(
				getNextDayStartInstant(now, 'America/Havana').getTime()
			).toBeGreaterThan(now.getTime());
		}
	});

	it('defaults to the club timezone, not the runtime one', () => {
		// Pinned to a literal rather than cross-called against an explicit
		// FALLBACK_TIMEZONE: that comparison holds even if both answers are wrong,
		// and the one thing worth pinning is that the default is not the runtime's.
		expect(
			getNextDayStartInstant(new Date('2026-09-04T20:00:00Z')).toISOString()
		).toBe('2026-09-05T16:00:00.000Z');
	});

	it('is always strictly ahead of the clock it was given', () => {
		// What the /events wake-up schedule rests on: each transition is later
		// than the last, so rescheduling from it walks forward instead of looping.
		for (const iso of [
			'2026-09-05T15:59:59.999Z',
			'2026-09-05T16:00:00.000Z',
			'2026-09-05T16:00:00.001Z',
		]) {
			const now = new Date(iso);
			expect(getNextDayStartInstant(now, TZ).getTime()).toBeGreaterThan(
				now.getTime()
			);
		}
	});
});

describe('getNextEventClockTransition', () => {
	// Taipei midnight, the rollover every case below is measured against.
	const NEXT_MIDNIGHT = Date.parse('2026-09-05T16:00:00.000Z');

	it('returns the millisecond after an event ends, not the end itself', () => {
		// `isEventEnded` compares `end < now`, so the rendered answer changes one
		// millisecond after the end instant. Returning the boundary itself is what
		// made a settling pad necessary.
		const now = new Date('2026-09-05T02:00:00Z');
		const events = [
			{
				eventDatetime: taipei('2026-09-05T13:00'),
				endDatetime: taipei('2026-09-05T15:00'),
			},
		];
		expect(getNextEventClockTransition(events, now)).toBe(
			Date.parse('2026-09-05T07:00:00.000Z') + 1
		);
	});

	it('ignores ends already behind the clock', () => {
		const now = new Date('2026-09-05T02:00:00Z');
		const events = [
			{
				eventDatetime: taipei('2026-09-01T13:00'),
				endDatetime: taipei('2026-09-01T15:00'),
			},
		];
		// Nothing left to finish today, so the next change is the day rolling over.
		expect(getNextEventClockTransition(events, now)).toBe(NEXT_MIDNIGHT);
	});

	it('takes the earliest of several pending ends', () => {
		const now = new Date('2026-09-05T02:00:00Z');
		const events = [
			{
				eventDatetime: taipei('2026-09-05T20:00'),
				endDatetime: taipei('2026-09-05T22:00'),
			},
			{
				eventDatetime: taipei('2026-09-05T11:00'),
				endDatetime: taipei('2026-09-05T12:00'),
			},
		];
		expect(getNextEventClockTransition(events, now)).toBe(
			Date.parse('2026-09-05T04:00:00.000Z') + 1
		);
	});

	it('falls back to the day rollover with no events at all', () => {
		expect(
			getNextEventClockTransition([], new Date('2026-09-05T02:00:00Z'))
		).toBe(NEXT_MIDNIGHT);
		expect(
			getNextEventClockTransition(null, new Date('2026-09-05T02:00:00Z'))
		).toBe(NEXT_MIDNIGHT);
	});

	it('reads the rollover in each event timezone, not only the club one', () => {
		// A Los Angeles event counts its days in its own zone, so its midnight is
		// a transition too — and on this clock it comes before Taipei's.
		const la = {
			_type: 'richDate' as const,
			local: '2026-09-04T20:00',
			utc: '2026-09-05T03:00:00.000Z',
			timezone: 'America/Los_Angeles',
			offset: -420,
		} as never;
		const now = new Date('2026-09-05T02:00:00Z');
		const result = getNextEventClockTransition(
			[{ eventDatetime: la, endDatetime: null }],
			now
		);
		expect(result).toBe(Date.parse('2026-09-05T07:00:00.000Z'));
		expect(result).toBeLessThan(NEXT_MIDNIGHT);
	});

	it('never answers with a past instant for a midnight-jump zone', () => {
		// The re-arm loop this guards: a past transition makes the caller's delay
		// zero, and the next scan returns the same past instant again.
		const events = [
			{
				eventDatetime: {
					_type: 'richDate',
					utc: '2026-06-01T05:00:00.000Z',
					timezone: 'America/Havana',
					local: '2026-06-01T01:00',
					offset: -240,
				} as unknown as RichDate,
				endDatetime: null,
			},
		];
		for (const iso of [
			'2026-03-08T04:00:00.000Z',
			'2026-03-08T04:30:00.000Z',
			'2026-03-08T04:59:59.999Z',
		]) {
			const now = new Date(iso);
			const next = getNextEventClockTransition(events, now);
			expect(Number.isFinite(next)).toBe(true);
			expect(next).toBeGreaterThan(now.getTime());
		}
	});

	it('is always strictly ahead of the clock, so re-arming cannot loop', () => {
		// The invariant the whole schedule rests on. Sampled either side of a real
		// transition, including exactly ON it.
		const events = [
			{
				eventDatetime: taipei('2026-09-05T13:00'),
				endDatetime: taipei('2026-09-05T15:00'),
			},
		];
		for (const iso of [
			'2026-09-05T06:59:59.999Z',
			'2026-09-05T07:00:00.000Z',
			'2026-09-05T07:00:00.001Z',
			'2026-09-05T15:59:59.999Z',
			'2026-09-05T16:00:00.000Z',
		]) {
			const now = new Date(iso);
			expect(getNextEventClockTransition(events, now)).toBeGreaterThan(
				now.getTime()
			);
		}
	});
});

describe('groupEventsByDay', () => {
	const events = [
		{ _id: 'a', eventDatetime: taipei('2026-09-05T07:00') },
		{ _id: 'b', eventDatetime: taipei('2026-09-05T19:30') },
		{ _id: 'c', eventDatetime: taipei('2026-09-12T07:00') },
		{ _id: 'd', eventDatetime: null },
	];

	it('buckets by start day and keeps the query order within a day', () => {
		const byDay = groupEventsByDay(events);
		expect(byDay.get('2026-09-05')?.map((e) => e._id)).toEqual(['a', 'b']);
		expect(byDay.get('2026-09-12')?.map((e) => e._id)).toEqual(['c']);
	});

	it('drops undated events rather than inventing a day for them', () => {
		const byDay = groupEventsByDay(events);
		expect([...byDay.values()].flat().map((e) => e._id)).not.toContain('d');
	});

	it('buckets a multi-day event on its start day only', () => {
		const byDay = groupEventsByDay([
			{
				_id: 'stage-race',
				eventDatetime: taipei('2026-09-05T07:00'),
				endDatetime: taipei('2026-09-07T18:00'),
			},
		]);
		expect(byDay.get('2026-09-05')?.map((e) => e._id)).toEqual(['stage-race']);
		expect(byDay.has('2026-09-06')).toBe(false);
		expect(byDay.has('2026-09-07')).toBe(false);
	});

	it('handles an empty or missing list', () => {
		expect(groupEventsByDay([]).size).toBe(0);
		expect(groupEventsByDay(null).size).toBe(0);
	});
});

describe('resolveEventTimezone', () => {
	// Two different bad inputs reach the same `RangeError` out of `Intl`, and
	// because every reader below runs during render, ONE of them took the whole
	// page to its error boundary rather than degrading its own row.
	//
	//   1. Draft mode, which is the broad one. `timezone` is not on
	//      `filterDefault`'s denylist (it lists `status`, not `timezone`) and is
	//      neither date-like nor URL-like, so the Presentation tool encodes
	//      invisible characters into it — for EVERY event, not a rare one.
	//   2. A stored value that was never IANA to begin with: `GMT+8`, `Taipei`,
	//      `UTC+08:00`, from a hand-edit or an import.
	const unusable = ['GMT+8', 'Taipei', 'UTC+08:00', ' ', 'Not/AZone'];

	const encoded = (value: string) =>
		vercelStegaCombine(value, { origin: 'sanity.io', href: '/studio' });

	it('guards the premise: Intl really does reject these', () => {
		// Without this, every test below could pass for the wrong reason if one
		// of these values quietly became valid.
		for (const timezone of [...unusable, encoded(TZ)]) {
			expect(() =>
				formatInTimeZone(new Date('2026-09-05T00:00:00Z'), timezone, 'yyyy')
			).toThrow(RangeError);
		}
	});

	it('keeps a timezone Intl can actually use', () => {
		expect(resolveEventTimezone(TZ)).toBe(TZ);
		expect(resolveEventTimezone('America/Los_Angeles')).toBe(
			'America/Los_Angeles'
		);
		// Aliases and non-region zones are valid IANA input too, so a membership
		// test against a curated list would wrongly reject them.
		expect(resolveEventTimezone('UTC')).toBe('UTC');
		expect(resolveEventTimezone('Etc/GMT-8')).toBe('Etc/GMT-8');
	});

	it('falls back when the value is missing', () => {
		expect(resolveEventTimezone(null)).toBe(FALLBACK_TIMEZONE);
		expect(resolveEventTimezone(undefined)).toBe(FALLBACK_TIMEZONE);
		expect(resolveEventTimezone('')).toBe(FALLBACK_TIMEZONE);
	});

	it('falls back instead of throwing on a value Intl rejects', () => {
		for (const timezone of unusable) {
			expect(resolveEventTimezone(timezone)).toBe(FALLBACK_TIMEZONE);
		}
	});

	it('cleans stega before judging, so draft mode keeps the real zone', () => {
		// The half that would be easy to get wrong: collapsing every encoded
		// value to the fallback would silently move a Los Angeles event into
		// Taipei for editors, which is a wrong answer rather than a crash.
		expect(resolveEventTimezone(encoded(TZ))).toBe(TZ);
		expect(resolveEventTimezone(encoded('America/Los_Angeles'))).toBe(
			'America/Los_Angeles'
		);
	});
});

describe('readers survive an unusable stored timezone', () => {
	const encodedTaipei = vercelStegaCombine(TZ, {
		origin: 'sanity.io',
		href: '/studio',
	});

	/** The same instant, restamped with a timezone the readers cannot use. */
	const restamp = (value: RichDate, timezone: string): RichDate => ({
		...value,
		timezone,
	});

	// 07:00 Taipei — 23:00 UTC the previous day, so a fallback that resolved in
	// the runtime timezone instead would visibly land on the 4th.
	const good = taipei('2026-09-05T07:00');
	const broken = restamp(good, 'GMT+8');
	const drafted = restamp(good, encodedTaipei);

	it('formatRichDate renders in the fallback rather than throwing', () => {
		expect(formatRichDate(broken, 'yyyy-MM-dd HH:mm')).toBe('2026-09-05 07:00');
		expect(formatRichDate(drafted, 'yyyy-MM-dd HH:mm')).toBe(
			'2026-09-05 07:00'
		);
	});

	it('getRichDateDayKey still buckets the event onto its own day', () => {
		expect(getRichDateDayKey(broken)).toBe('2026-09-05');
		expect(getRichDateDayKey(drafted)).toBe('2026-09-05');
	});

	it('getRichDateYearMonth still reports the local month', () => {
		expect(getRichDateYearMonth(broken)).toEqual({ year: 2026, month: 8 });
		expect(getRichDateYearMonth(drafted)).toEqual({ year: 2026, month: 8 });
	});

	it('groupEventsByDay keeps the event instead of dropping the grid', () => {
		const byDay = groupEventsByDay([
			{ _id: 'broken', eventDatetime: broken },
			{ _id: 'drafted', eventDatetime: drafted },
		]);
		expect(byDay.get('2026-09-05')?.map((e) => e._id)).toEqual([
			'broken',
			'drafted',
		]);
	});

	it('isEventEnded still uses the end-of-day fallback', () => {
		// 23:59:59.999 Taipei on the 5th, so mid-afternoon that day is not over
		// and the next morning is.
		expect(
			isEventEnded(broken, null, new Date('2026-09-05T15:00:00+08:00'))
		).toBe(false);
		expect(
			isEventEnded(broken, null, new Date('2026-09-06T09:00:00+08:00'))
		).toBe(true);
		expect(
			isEventEnded(drafted, null, new Date('2026-09-05T15:00:00+08:00'))
		).toBe(false);
	});

	it('getDaysUntilEvent still counts in whole local days', () => {
		// Inside the 3-day pill window, so the count itself is asserted rather
		// than the `null` every far-off event returns either way.
		const soon = taipei('2026-09-01T07:00');
		expect(getDaysUntilEvent(restamp(soon, 'GMT+8'), NOW)).toBe(2);
		expect(getDaysUntilEvent(restamp(soon, encodedTaipei), NOW)).toBe(2);
	});
});

// The three readers above that main's blocks reach only indirectly, through the
// unusable-timezone backstop. Asserted directly here so a regression in one of
// them names itself rather than surfacing as a fallback test failing.
describe('formatRichDate', () => {
	it('returns an empty string when there is no usable instant', () => {
		expect(formatRichDate(null, 'yyyy')).toBe('');
		expect(formatRichDate(undefined, 'yyyy')).toBe('');
		expect(formatRichDate({ _type: 'richDate' }, 'yyyy')).toBe('');
	});

	it('formats in the stored timezone, not the runtime one', () => {
		// 22:00 on the 4th in Los Angeles (the suite's TZ) and still the 4th in
		// UTC, but already the 5th in Taipei.
		expect(formatRichDate(taipei('2026-09-05T07:00'), 'yyyy-MM-dd')).toBe(
			'2026-09-05'
		);
	});

	it('falls back to the club timezone when none is stored', () => {
		expect(
			formatRichDate(
				{ _type: 'richDate', utc: '2026-09-04T23:00:00.000Z' },
				'yyyy-MM-dd'
			)
		).toBe('2026-09-05');
	});
});

describe('getRichDateInstant', () => {
	it('returns the stored UTC instant', () => {
		expect(getRichDateInstant(taipei('2026-09-05T07:00'))?.toISOString()).toBe(
			'2026-09-04T23:00:00.000Z'
		);
	});

	it('returns null for a missing, empty or unparseable value', () => {
		expect(getRichDateInstant(null)).toBeNull();
		expect(getRichDateInstant({ _type: 'richDate' })).toBeNull();
		expect(
			getRichDateInstant({ _type: 'richDate', utc: 'not-a-date' })
		).toBeNull();
	});
});

describe('getRichDateYearMonth', () => {
	it('reports a 0-based month index', () => {
		expect(getRichDateYearMonth(taipei('2026-09-05T07:00'))).toEqual({
			year: 2026,
			month: 8,
		});
	});

	it('decides the month in the stored timezone at a month boundary', () => {
		// 2026-09-30 23:00 Taipei is still September there and the 30th in UTC,
		// but resolved in the runtime zone it would land in the previous day.
		expect(getRichDateYearMonth(taipei('2026-09-30T23:00'))).toEqual({
			year: 2026,
			month: 8,
		});
		expect(getRichDateYearMonth(taipei('2026-10-01T01:00'))).toEqual({
			year: 2026,
			month: 9,
		});
	});

	it('returns null when there is no usable instant', () => {
		expect(getRichDateYearMonth(null)).toBeNull();
		expect(getRichDateYearMonth({ _type: 'richDate' })).toBeNull();
	});
});
