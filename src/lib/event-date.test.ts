import { describe, it, expect } from 'vitest';
import type { RichDate } from 'sanity.types';
import { isEventEnded, selectUpcomingEvents } from './event-date';

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
			selectUpcomingEvents([past, today, soon], { now: NOW, timeWindow: 'all' })
		).toEqual([today, soon]);
	});

	it('keeps a multi-day event whose end time is still ahead', () => {
		const running = event('2026-08-28T07:00', '2026-08-31T18:00');
		expect(
			selectUpcomingEvents([running], { now: NOW, timeWindow: 'all' })
		).toEqual([running]);
	});

	it('counts the week window in whole calendar days, inclusive of day 7', () => {
		const day7 = event('2026-09-06T09:00');
		const day8 = event('2026-09-07T09:00');
		expect(
			selectUpcomingEvents([day7, day8], { now: NOW, timeWindow: 'week' })
		).toEqual([day7]);
	});

	it('includes an event later today in a narrowed window (day 0)', () => {
		const laterToday = event('2026-08-30T20:00');
		expect(
			selectUpcomingEvents([laterToday], { now: NOW, timeWindow: 'week' })
		).toEqual([laterToday]);
	});

	it('applies the 30-day month window', () => {
		const inRange = event('2026-09-29T09:00');
		const outOfRange = event('2026-10-05T09:00');
		expect(
			selectUpcomingEvents([inRange, outOfRange], {
				now: NOW,
				timeWindow: 'month',
			})
		).toEqual([inRange]);
	});

	it('treats an unrecognised or missing window as "all upcoming"', () => {
		const far = event('2027-06-01T09:00');
		expect(selectUpcomingEvents([far], { now: NOW })).toEqual([far]);
		expect(
			// A stega-polluted value from draft mode lands here too.
			selectUpcomingEvents([far], { now: NOW, timeWindow: 'week​xyz' })
		).toEqual([far]);
	});

	it('excludes an undated event from a narrowed window but not from "all"', () => {
		const undated = { eventDatetime: null, endDatetime: null };
		expect(
			selectUpcomingEvents([undated], { now: NOW, timeWindow: 'week' })
		).toEqual([]);
		expect(
			selectUpcomingEvents([undated], { now: NOW, timeWindow: 'all' })
		).toEqual([undated]);
	});

	it('defaults to five when no limit is stored, and honours a stored zero', () => {
		const many = Array.from({ length: 8 }, (_, i) =>
			event(`2026-09-0${i + 1}T09:00`)
		);
		expect(selectUpcomingEvents(many, { now: NOW })).toHaveLength(5);
		expect(selectUpcomingEvents(many, { now: NOW, limit: 3 })).toHaveLength(3);
		// `?? `, not `||` — a stored 0 is an answer, not an absence.
		expect(selectUpcomingEvents(many, { now: NOW, limit: 0 })).toHaveLength(0);
	});
});
