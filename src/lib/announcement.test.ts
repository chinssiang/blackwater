import { describe, expect, it } from 'vitest';
import {
	announcementIntervalMs,
	clampMessageIndex,
	resolveAnnouncementColors,
} from '@/lib/announcement';

const black = { rgb: { r: 0, g: 0, b: 0, a: 1 } };
const white = { rgb: { r: 255, g: 255, b: 255, a: 1 } };
const darkGrey = { rgb: { r: 40, g: 40, b: 40, a: 1 } };

describe('announcementIntervalMs', () => {
	it('uses the authored interval in milliseconds', () => {
		expect(announcementIntervalMs(8)).toBe(8000);
	});

	it('falls back to the default when unset or zero', () => {
		expect(announcementIntervalMs(null)).toBe(10000);
		expect(announcementIntervalMs(0)).toBe(10000);
	});

	it('floors tiny and negative values so the bar cannot flash', () => {
		expect(announcementIntervalMs(0.1)).toBe(3000);
		expect(announcementIntervalMs(-5)).toBe(3000);
	});
});

describe('clampMessageIndex', () => {
	it('keeps an index that still exists', () => {
		expect(clampMessageIndex(1, 3)).toBe(1);
	});

	it('falls back to the first message when the list shrank past it', () => {
		expect(clampMessageIndex(2, 2)).toBe(0);
	});
});

describe('resolveAnnouncementColors', () => {
	it('leaves every colour to the theme when none is authored', () => {
		expect(
			resolveAnnouncementColors({
				backgroundColor: null,
				textColor: null,
				emphasizeColor: null,
			})
		).toEqual({ paper: false, ink: false, emphasis: false });
	});

	it('keeps the authored alpha on the paper', () => {
		const { paper } = resolveAnnouncementColors({
			backgroundColor: { rgb: { r: 0, g: 0, b: 0, a: 0.5 } },
			textColor: null,
			emphasizeColor: null,
		});
		expect(paper).toBe('rgba(0, 0, 0, 0.5)');
	});

	it('replaces an illegible authored ink', () => {
		const { ink } = resolveAnnouncementColors({
			backgroundColor: black,
			textColor: darkGrey,
			emphasizeColor: null,
		});
		expect(ink).not.toBe('rgba(40, 40, 40, 1)');
	});

	it('drops ink and emphasis authored without a paper to check them against', () => {
		const { ink, emphasis } = resolveAnnouncementColors({
			backgroundColor: null,
			textColor: white,
			emphasizeColor: white,
		});
		expect(ink).toBe(false);
		expect(emphasis).toBe(false);
	});
});
