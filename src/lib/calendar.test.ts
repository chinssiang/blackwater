import { describe, it, expect } from 'vitest';
import { zhTW } from 'date-fns/locale';
import type { RichDate } from 'sanity.types';
import {
	addMonths,
	buildMonthGrid,
	buildWeekdayHeadings,
	formatDayKey,
	getDayKeyYearMonth,
	getMonthRange,
	getRichDateDayKey,
	getTodayKey,
	groupEventsByDay,
	isSameMonth,
	toMonthIndex,
} from './calendar';

// Same fixture shape as event-date.test.ts: Taipei (UTC+8, no DST) is the
// timezone the events are authored in.
const TZ = 'Asia/Taipei';

function taipei(local: string): RichDate {
	return {
		_type: 'richDate',
		local,
		utc: new Date(`${local}:00+08:00`).toISOString(),
		timezone: TZ,
		offset: 480,
	};
}

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
	it('resolves today in the calendar timezone, not the runtime one', () => {
		// 2026-09-04T20:00 UTC is already the 5th in Taipei.
		expect(getTodayKey(new Date('2026-09-04T20:00:00Z'), TZ)).toBe(
			'2026-09-05'
		);
	});
});

describe('buildMonthGrid', () => {
	it('always returns six whole weeks so the grid height never jumps', () => {
		for (const month of [0, 1, 5, 11]) {
			expect(buildMonthGrid({ year: 2026, month })).toHaveLength(42);
		}
		// February 2027 starts on a Monday and has 28 days -- the shortest
		// possible month grid, and still six rows.
		expect(buildMonthGrid({ year: 2027, month: 1 })).toHaveLength(42);
	});

	it('starts the week where the locale says (Sunday vs Monday)', () => {
		// 2026-09-01 is a Tuesday.
		const sundayFirst = buildMonthGrid({ year: 2026, month: 8 }, 0);
		expect(sundayFirst[0].key).toBe('2026-08-30');
		const mondayFirst = buildMonthGrid({ year: 2026, month: 8 }, 1);
		expect(mondayFirst[0].key).toBe('2026-08-31');
	});

	it('flags padding days from the neighbouring months', () => {
		const grid = buildMonthGrid({ year: 2026, month: 8 }, 0);
		expect(grid[0]).toMatchObject({
			key: '2026-08-30',
			day: 30,
			isCurrentMonth: false,
		});
		expect(grid[2]).toMatchObject({
			key: '2026-09-01',
			day: 1,
			isCurrentMonth: true,
		});
		expect(grid.filter((d) => d.isCurrentMonth)).toHaveLength(30);
	});

	it('crosses a year boundary without losing a day', () => {
		const grid = buildMonthGrid({ year: 2026, month: 11 }, 0);
		const december = grid.filter((d) => d.isCurrentMonth);
		expect(december).toHaveLength(31);
		expect(december[30].key).toBe('2026-12-31');
		expect(grid[grid.length - 1].key.startsWith('2027-01')).toBe(true);
	});

	it('gives February the right length in a leap year', () => {
		expect(
			buildMonthGrid({ year: 2028, month: 1 }).filter((d) => d.isCurrentMonth)
		).toHaveLength(29);
	});

	it('emits zero-padded keys that sort lexicographically', () => {
		const grid = buildMonthGrid({ year: 2026, month: 0 }, 0);
		const keys = grid.map((d) => d.key);
		expect(keys).toEqual([...keys].sort());
		expect(keys).toContain('2026-01-05');
	});
});

describe('buildWeekdayHeadings', () => {
	it('orders the seven headings from the locale week start', () => {
		// 2024-01-07 was a Sunday, so a Sunday-first week runs 07→13 and a
		// Monday-first one 08→14.
		expect(buildWeekdayHeadings(0)).toEqual([
			'2024-01-07',
			'2024-01-08',
			'2024-01-09',
			'2024-01-10',
			'2024-01-11',
			'2024-01-12',
			'2024-01-13',
		]);
		expect(buildWeekdayHeadings(1)[0]).toBe('2024-01-08');
		expect(buildWeekdayHeadings(1)[6]).toBe('2024-01-14');
	});
});

describe('formatDayKey', () => {
	it('renders the civil date itself, not the runtime timezone reading of it', () => {
		// The trap: `format(new Date('2026-09-05'))` in any timezone west of UTC
		// prints the 4th. Every date this calendar shows goes through here.
		expect(formatDayKey('2026-09-05', 'yyyy-MM-dd')).toBe('2026-09-05');
		expect(formatDayKey('2026-09-05', 'EEEE')).toBe('Saturday');
		expect(formatDayKey('2026-01-01', 'd MMMM yyyy')).toBe('1 January 2026');
	});

	it('formats through a date-fns locale when given one', () => {
		expect(formatDayKey('2026-09-05', 'EEEE', zhTW)).toBe('星期六');
		expect(formatDayKey('2026-09-05', 'EEE', zhTW)).toBe('週六');
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

describe('month index arithmetic', () => {
	it('steps across a year boundary in both directions', () => {
		expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({
			year: 2027,
			month: 0,
		});
		expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({
			year: 2025,
			month: 11,
		});
		expect(addMonths({ year: 2026, month: 5 }, 12)).toEqual({
			year: 2027,
			month: 5,
		});
	});

	it('round-trips a day key through its year/month', () => {
		expect(getDayKeyYearMonth('2026-09-05')).toEqual({ year: 2026, month: 8 });
	});

	it('compares months without touching Date', () => {
		expect(
			isSameMonth({ year: 2026, month: 8 }, { year: 2026, month: 8 })
		).toBe(true);
		expect(
			isSameMonth({ year: 2026, month: 8 }, { year: 2027, month: 8 })
		).toBe(false);
		expect(toMonthIndex({ year: 2026, month: 8 })).toBeGreaterThan(
			toMonthIndex({ year: 2026, month: 7 })
		);
	});
});

describe('getMonthRange', () => {
	const NOW = new Date('2026-09-03T14:00:00+08:00');

	it('spans the earliest and latest event months', () => {
		const range = getMonthRange(
			[
				{ eventDatetime: taipei('2026-03-05T07:00') },
				{ eventDatetime: taipei('2026-12-20T07:00') },
			],
			NOW,
			TZ
		);
		expect(range.min).toBe(toMonthIndex({ year: 2026, month: 2 }));
		expect(range.max).toBe(toMonthIndex({ year: 2026, month: 11 }));
	});

	it("always includes today's month, so an empty calendar still opens somewhere real", () => {
		const range = getMonthRange([], NOW, TZ);
		const september = toMonthIndex({ year: 2026, month: 8 });
		expect(range).toEqual({ min: september, max: september });
	});

	it('extends around today when every event is in the past', () => {
		const range = getMonthRange(
			[{ eventDatetime: taipei('2026-01-05T07:00') }],
			NOW,
			TZ
		);
		expect(range.min).toBe(toMonthIndex({ year: 2026, month: 0 }));
		expect(range.max).toBe(toMonthIndex({ year: 2026, month: 8 }));
	});
});
