import { describe, it, expect } from 'vitest';
import type { RichDate } from 'sanity.types';
import {
	getDaysUntilEvent,
	getRichDateDayKey,
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
