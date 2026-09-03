import { describe, it, expect } from 'vitest';
import type { RichDate } from 'sanity.types';
import {
	getDaysUntilEvent,
	isDateFirm,
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

// The single gate three surfaces share for "is this date real". Before it was
// extracted, each spelled the predicate out and they were free to drift.
describe('isDateFirm', () => {
	it('treats an unset status as confirmed', () => {
		// Most events carry no dateStatus at all; they must still show their date.
		expect(isDateFirm(undefined)).toBe(true);
		expect(isDateFirm(null)).toBe(true);
	});

	it('accepts the confirmed status', () => {
		expect(isDateFirm('confirmed')).toBe(true);
	});

	it('rejects every status that means the date is not real', () => {
		expect(isDateFirm('tba')).toBe(false);
		expect(isDateFirm('postponed')).toBe(false);
		expect(isDateFirm('cancelled')).toBe(false);
	});

	it('rejects an unrecognised status rather than assuming it is firm', () => {
		// A schema value added later must not start rendering a date until
		// someone decides it should.
		expect(isDateFirm('rescheduled')).toBe(false);
	});
});
