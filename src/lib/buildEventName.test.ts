import { describe, expect, it } from 'vitest';
import { buildEventName } from './buildEventName';

describe('buildEventName', () => {
	it('joins title, subtitle, location and date with a middle dot', () => {
		const name = buildEventName(
			{
				title: 'BW-134-rr',
				subtitle: 'Summer Series',
				location: 'Taipei Velodrome',
				eventDatetime: '2025-06-22T18:30:00.000Z',
				timezone: 'Asia/Taipei',
			},
			'en'
		);
		expect(name).toBe(
			'BW-134-rr — Summer Series · Taipei Velodrome · Jun 23, 2025'
		);
	});

	it('uses just the title when there is no subtitle', () => {
		expect(buildEventName({ title: 'BW-134-rr' }, 'en')).toBe('BW-134-rr');
	});

	it('omits the date segment when the datetime is invalid', () => {
		expect(
			buildEventName(
				{ title: 'BW-134-rr', eventDatetime: 'not-a-date' },
				'en'
			)
		).toBe('BW-134-rr');
	});

	it('formats the date in the requested locale', () => {
		const zh = buildEventName(
			{
				title: 'BW-134-rr',
				eventDatetime: '2025-06-22T18:30:00.000Z',
				timezone: 'Asia/Taipei',
			},
			'zh_tw'
		);
		expect(zh).toBe('BW-134-rr · 2025年6月23日');
	});

	it('falls back to Asia/Taipei when no timezone is provided', () => {
		const name = buildEventName(
			{ title: 'BW-134-rr', eventDatetime: '2025-06-22T18:30:00.000Z' },
			'en'
		);
		expect(name).toBe('BW-134-rr · Jun 23, 2025');
	});

	it('drops empty segments and returns an empty string for no usable parts', () => {
		expect(buildEventName({}, 'en')).toBe('');
		expect(buildEventName({ title: '', location: 'Track' }, 'en')).toBe(
			'Track'
		);
	});
});
