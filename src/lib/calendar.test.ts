import { describe, it, expect } from 'vitest';
import { zhTW } from 'date-fns/locale';
import {
	buildMonthGrid,
	buildWeekdayHeadings,
	formatDayKey,
	fromMonthIndex,
	getDayKeyYearMonth,
	monthStartKey,
	toMonthIndex,
} from './calendar';

// Pure geometry: no RichDate and no timezone here. The rules about reading a
// stored value in the timezone it was authored in live in event-date.test.ts,
// beside the functions that own them.

/** The grid as one flat list, for the assertions that count days. */
const flat = (weeks: ReturnType<typeof buildMonthGrid>) => weeks.flat();

describe('buildMonthGrid', () => {
	it('always returns six whole weeks so the grid height never jumps', () => {
		for (const month of [0, 1, 5, 11]) {
			const weeks = buildMonthGrid({ year: 2026, month });
			expect(weeks).toHaveLength(6);
			expect(weeks.every((week) => week.length === 7)).toBe(true);
		}
		// February 2027 starts on a Monday and has 28 days -- the shortest
		// possible month grid, and still six rows.
		expect(buildMonthGrid({ year: 2027, month: 1 })).toHaveLength(6);
	});

	it('starts the week where the locale says (Sunday vs Monday)', () => {
		// 2026-09-01 is a Tuesday.
		expect(buildMonthGrid({ year: 2026, month: 8 }, 0)[0][0].key).toBe(
			'2026-08-30'
		);
		expect(buildMonthGrid({ year: 2026, month: 8 }, 1)[0][0].key).toBe(
			'2026-08-31'
		);
	});

	it('flags padding days from the neighbouring months', () => {
		const weeks = buildMonthGrid({ year: 2026, month: 8 }, 0);
		expect(weeks[0][0]).toMatchObject({
			key: '2026-08-30',
			day: 30,
			isCurrentMonth: false,
		});
		expect(weeks[0][2]).toMatchObject({
			key: '2026-09-01',
			day: 1,
			isCurrentMonth: true,
		});
		expect(flat(weeks).filter((d) => d.isCurrentMonth)).toHaveLength(30);
	});

	it('crosses a year boundary without losing a day', () => {
		const weeks = buildMonthGrid({ year: 2026, month: 11 }, 0);
		const december = flat(weeks).filter((d) => d.isCurrentMonth);
		expect(december).toHaveLength(31);
		expect(december[30].key).toBe('2026-12-31');
		expect(weeks[5][6].key.startsWith('2027-01')).toBe(true);
	});

	it('gives February the right length in a leap year', () => {
		expect(
			flat(buildMonthGrid({ year: 2028, month: 1 })).filter(
				(d) => d.isCurrentMonth
			)
		).toHaveLength(29);
	});

	it('emits zero-padded keys that sort lexicographically', () => {
		const keys = flat(buildMonthGrid({ year: 2026, month: 0 }, 0)).map(
			(d) => d.key
		);
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

describe('month index arithmetic', () => {
	it('round-trips a month through its index, across a year boundary', () => {
		for (const month of [
			{ year: 2026, month: 0 },
			{ year: 2026, month: 11 },
		]) {
			expect(fromMonthIndex(toMonthIndex(month))).toEqual(month);
		}
		// Stepping is integer addition at the call site, so the index either side
		// of a year boundary has to land on the neighbouring month.
		expect(fromMonthIndex(toMonthIndex({ year: 2026, month: 11 }) + 1)).toEqual(
			{
				year: 2027,
				month: 0,
			}
		);
		expect(fromMonthIndex(toMonthIndex({ year: 2026, month: 0 }) - 1)).toEqual({
			year: 2025,
			month: 11,
		});
	});

	it('orders months monotonically, so min/max and range checks are integer', () => {
		expect(toMonthIndex({ year: 2026, month: 8 })).toBeGreaterThan(
			toMonthIndex({ year: 2026, month: 7 })
		);
		expect(toMonthIndex({ year: 2027, month: 0 })).toBeGreaterThan(
			toMonthIndex({ year: 2026, month: 11 })
		);
	});

	it('round-trips a day key through its year/month', () => {
		expect(getDayKeyYearMonth('2026-09-05')).toEqual({ year: 2026, month: 8 });
	});

	it('builds a zero-padded first-of-month key', () => {
		expect(monthStartKey({ year: 2026, month: 0 })).toBe('2026-01-01');
		expect(monthStartKey({ year: 2026, month: 8 })).toBe('2026-09-01');
	});
});
