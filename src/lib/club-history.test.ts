import { describe, expect, it } from 'vitest';
import { buildClubHistory, splitClubHistory } from './club-history';

const row = (lumaEventUrl: string, extra = {}) => ({
	lumaEventUrl,
	eventName: '',
	eventStartsAt: null,
	checkedIn: false,
	...extra,
});

const event = (lumaUrl: string, utc: string, extra = {}) => ({
	_id: lumaUrl,
	title: 'Sunrise run',
	slug: 'sunrise-run',
	eventDatetime: {
		_type: 'richDate' as const,
		utc,
		timezone: 'Asia/Taipei',
	},
	lumaUrl,
	...extra,
});

describe('buildClubHistory', () => {
	it('matches an event however its Luma link was pasted', () => {
		const [entry] = buildClubHistory(
			[row('https://luma.com/sunrise', { checkedIn: true })],
			[event('https://lu.ma/sunrise/?utm_source=ig', '2026-09-01T22:00:00Z')]
		);
		expect(entry).toMatchObject({
			title: 'Sunrise run',
			slug: 'sunrise-run',
			startsAt: new Date('2026-09-01T22:00:00Z'),
			timeZone: 'Asia/Taipei',
			checkedIn: true,
		});
	});

	it("keeps an event the site has no page for, under Luma's name", () => {
		const startsAt = new Date('2026-08-01T00:00:00Z');
		const [entry] = buildClubHistory(
			[
				row('https://luma.com/social', {
					eventName: 'Summer social',
					eventStartsAt: startsAt,
				}),
			],
			[]
		);
		expect(entry).toMatchObject({ title: 'Summer social', slug: null });
	});

	it('lists newest first, undated rows last', () => {
		const history = buildClubHistory(
			[
				row('https://luma.com/a'),
				row('https://luma.com/b'),
				row('https://luma.com/c'),
			],
			[
				event('https://luma.com/a', '2026-01-01T00:00:00Z'),
				event('https://luma.com/c', '2026-06-01T00:00:00Z'),
			]
		);
		expect(history.map((e) => e.key)).toEqual([
			'https://luma.com/c',
			'https://luma.com/a',
			'https://luma.com/b',
		]);
	});

	it('splits at now: soonest upcoming first, newest past first', () => {
		const history = buildClubHistory(
			['a', 'b', 'c', 'd'].map((k) => row(`https://luma.com/${k}`)),
			[
				event('https://luma.com/a', '2026-01-01T00:00:00Z'),
				event('https://luma.com/b', '2026-03-01T00:00:00Z'),
				event('https://luma.com/c', '2026-12-01T00:00:00Z'),
				event('https://luma.com/d', '2026-11-01T00:00:00Z'),
			]
		);
		const { upcoming, past } = splitClubHistory(
			history,
			Date.parse('2026-06-01T00:00:00Z')
		);
		expect(upcoming.map((e) => e.key.at(-1))).toEqual(['d', 'c']);
		expect(past.map((e) => e.key.at(-1))).toEqual(['b', 'a']);
	});
});
