import { describe, expect, it } from 'vitest';
import type { RichDate } from 'sanity.types';
import {
	formatRichDate,
	getRichDateInstant,
	getRichDateYearMonth,
} from './event-date';

// 2025-06-22T18:30:00Z is 2025-06-23 02:30 in Asia/Taipei (UTC+8).
const taipeiMidnightCrossing: RichDate = {
	_type: 'richDate',
	utc: '2025-06-22T18:30:00.000Z',
	timezone: 'Asia/Taipei',
};

describe('formatRichDate', () => {
	it('returns an empty string when there is no usable instant', () => {
		expect(formatRichDate(null, 'yyyy')).toBe('');
		expect(formatRichDate(undefined, 'yyyy')).toBe('');
		expect(formatRichDate({ _type: 'richDate' }, 'yyyy')).toBe('');
	});

	it('formats in the stored timezone, not the runtime timezone', () => {
		// In UTC this is the 22nd; rendered in Taipei it is the 23rd.
		expect(formatRichDate(taipeiMidnightCrossing, 'yyyy-MM-dd')).toBe(
			'2025-06-23'
		);
	});

	it('falls back to Asia/Taipei when no timezone is stored', () => {
		const noTz: RichDate = {
			_type: 'richDate',
			utc: '2025-06-22T18:30:00.000Z',
		};
		expect(formatRichDate(noTz, 'yyyy-MM-dd')).toBe('2025-06-23');
	});
});

describe('getRichDateInstant', () => {
	it('returns a Date for a valid utc value', () => {
		const instant = getRichDateInstant(taipeiMidnightCrossing);
		expect(instant?.toISOString()).toBe('2025-06-22T18:30:00.000Z');
	});

	it('returns null for missing or invalid values', () => {
		expect(getRichDateInstant(null)).toBeNull();
		expect(getRichDateInstant({ _type: 'richDate' })).toBeNull();
		expect(
			getRichDateInstant({ _type: 'richDate', utc: 'not-a-date' })
		).toBeNull();
	});
});

describe('getRichDateYearMonth', () => {
	it('groups by the local month with a 0-based index', () => {
		expect(getRichDateYearMonth(taipeiMidnightCrossing)).toEqual({
			year: 2025,
			month: 5, // June, 0-based
		});
	});

	it('uses the stored timezone to decide the month near a boundary', () => {
		// 2025-06-30T20:00:00Z is 2025-07-01 04:00 in Taipei → July.
		const crossesIntoJuly: RichDate = {
			_type: 'richDate',
			utc: '2025-06-30T20:00:00.000Z',
			timezone: 'Asia/Taipei',
		};
		expect(getRichDateYearMonth(crossesIntoJuly)).toEqual({
			year: 2025,
			month: 6, // July, 0-based
		});
	});

	it('returns null when there is no usable instant', () => {
		expect(getRichDateYearMonth(null)).toBeNull();
		expect(getRichDateYearMonth({ _type: 'richDate' })).toBeNull();
	});
});
