import { describe, expect, it } from 'vitest';
import {
	buildEventDraft,
	matchCategory,
	matchLocation,
	parseEventCsv,
	parseEventText,
	parseTime,
	toRichDate,
} from './event-import';

const TODAY = new Date(2026, 8, 28); // 2026-09-28

const PASTE = `OR

• 10/31 (六) BW 183 SRP / 7:00AM / Sunrise Program 5K @ 大巨蛋.
• 11/5 BW 177 NB / 7:00AM / NB + Mercedes-Benz @ 賓航賓士 永和.
• BW 184 NB / 6:30AM / NB 10K Run @ 大佳河濱公園.

• 10/31 BW 183 SRP / 7:00AM / Sunrise Program 5K @ Taipei Dome.
• 11/5 BW 177 NB / 7:30AM / NB + Mercedes-Benz @ Mercedes-Benz Yonghe.
• 10/25 BW 181 OS / — / Team Off-site @ EVA Marathon.
`;

describe('parseTime', () => {
	it.each([
		['7:00AM', '07:00'],
		['7:45 PM', '19:45'],
		['12:00AM', '00:00'],
		['12:30pm', '12:30'],
		['19:45', '19:45'],
		['—', null],
	])('reads %s', (raw, expected) => {
		expect(parseTime(raw)).toBe(expected);
	});

	it('rejects garbage', () => {
		expect(parseTime('morning')).toBeUndefined();
	});
});

describe('parseEventText', () => {
	const { rows, skipped } = parseEventText(PASTE, TODAY);
	const byNumber = (n: number) => rows.find((r) => r.number === n)!;

	it('pairs the Chinese and English copies into one row', () => {
		expect(byNumber(183)).toMatchObject({
			title: 'BW 183 SRP',
			slug: 'bw-183-srp',
			date: '2026-10-31',
			time: '07:00',
			subtitle: { en: 'Sunrise Program 5K', zh_tw: 'Sunrise Program 5K' },
			location: { en: 'Taipei Dome', zh_tw: '大巨蛋' },
			errors: [],
		});
	});

	it('skips an event line with no date', () => {
		expect(skipped).toEqual([
			{ source: expect.stringContaining('BW 184'), reason: 'No date.' },
		]);
		expect(rows.some((r) => r.number === 184)).toBe(false);
	});

	it('flags languages that disagree on the time', () => {
		expect(byNumber(177).errors).toEqual([
			'Languages disagree on time: 07:00 vs 07:30.',
		]);
	});

	it('fills a missing language from the other and keeps "—" as no time', () => {
		expect(byNumber(181)).toMatchObject({
			time: null,
			subtitle: { en: 'Team Off-site', zh_tw: 'Team Off-site' },
		});
	});

	it('reads a bullet that follows the date', () => {
		const { rows } = parseEventText(
			'10/31 • BW 183 SRP / 7:00AM / Sunrise Program 5K @ Taipei Dome',
			TODAY
		);
		expect(rows[0]).toMatchObject({ number: 183, date: '2026-10-31' });
	});

	it('keeps an English list with one Chinese venue as English', () => {
		const { rows } = parseEventText(
			'• 10/31 BW 183 SRP / 7:00AM / Sunrise 5K @ 大巨蛋\n' +
				'• 11/5 BW 177 NB / 7:00AM / NB Run @ Yonghe\n' +
				'• 11/6 BW 178 RR / 7:00AM / Reset @ Park',
			TODAY
		);
		expect(rows[0].subtitle).toEqual({ en: 'Sunrise 5K', zh_tw: 'Sunrise 5K' });
		expect(rows[0].location.en).toBe('大巨蛋');
	});

	it('rolls a month/day far in the past into next year', () => {
		const { rows } = parseEventText(
			'• 1/3 BW 200 RR / 7:45PM / Run @ Park',
			new Date(2026, 11, 20)
		);
		expect(rows[0].date).toBe('2027-01-03');
	});
});

describe('parseEventCsv', () => {
	it('reads a header row in any order, with quoted fields', () => {
		const csv =
			'\uFEFFtitle,date,time,subtitle_en,subtitle_zh,location_en,location_zh\r\n' +
			'BW 174 RR,2026-10-15,7:45PM,"Midweek Reset 6K, 10K",週間緩和跑,CKS Memorial Hall,中正紀念堂\r\n' +
			'BW 175 CR,,7:00AM,Coffee,,Foca Poca,\r\n';
		const { rows, skipped } = parseEventCsv(csv, TODAY);
		expect(rows).toEqual([
			expect.objectContaining({
				slug: 'bw-174-rr',
				date: '2026-10-15',
				time: '19:45',
				subtitle: { en: 'Midweek Reset 6K, 10K', zh_tw: '週間緩和跑' },
			}),
		]);
		expect(skipped[0].reason).toBe('No date.');
	});

	it('reports a row with no subtitle or location as skipped', () => {
		const { rows, skipped } = parseEventCsv(
			'date,title,time\n2026-10-31,BW 183 SRP,7:00AM\n',
			TODAY
		);
		expect(rows).toEqual([]);
		expect(skipped[0].reason).toBe('No subtitle or location.');
	});

	it('names the missing columns', () => {
		expect(() => parseEventCsv('time\n7:00AM')).toThrow(/date and title/);
	});
});

describe('matchLocation', () => {
	const locations = [
		{
			_id: 'stadium',
			name: [
				{ language: 'en', value: 'Taipei Municipal Stadium' },
				{ language: 'zh_tw', value: '臺北田徑場' },
			],
		},
		{ _id: 'daan', name: [{ language: 'en', value: "Da'an Forest Park" }] },
	];

	it('treats 台 and 臺 as the same character', () => {
		expect(
			matchLocation(
				{ location: { en: 'Taipei Stadium', zh_tw: '台北田徑場' } },
				locations
			)
		).toBe('stadium');
	});

	it('ignores curly apostrophes and case', () => {
		expect(
			matchLocation(
				{ location: { en: 'da’an forest park', zh_tw: '' } },
				locations
			)
		).toBe('daan');
	});

	it('returns null when nothing matches', () => {
		expect(
			matchLocation({ location: { en: 'Moon', zh_tw: '' } }, locations)
		).toBeNull();
	});
});

describe('matchCategory', () => {
	const categories = [
		{
			_id: 'srp',
			title: [{ language: 'en', value: 'Sunrise Program (SRP)' }],
			slug: 'srp',
		},
		{
			_id: 'sr',
			title: [{ language: 'en', value: 'Shakeout Run (SR)' }],
			slug: 'shakeout-run',
		},
	];

	it('matches the code in parentheses, not a prefix of another code', () => {
		expect(matchCategory('SR', categories)).toBe('sr');
		expect(matchCategory('SRP', categories)).toBe('srp');
	});

	it('returns null for a code with no category', () => {
		expect(matchCategory('NB', categories)).toBeNull();
	});
});

describe('toRichDate', () => {
	it('stores Taipei local time with its UTC instant', () => {
		expect(toRichDate('2026-10-31', '07:00')).toEqual({
			_type: 'richDate',
			local: '2026-10-31T07:00:00+08:00',
			utc: '2026-10-30T23:00:00.000Z',
			timezone: 'Asia/Taipei',
			offset: 480,
		});
	});
});

describe('buildEventDraft', () => {
	const [row] = parseEventText(
		'• 10/25 BW 181 OS / — / Team Off-site @ EVA Marathon',
		TODAY
	).rows;

	it('creates a draft with a one-off location when no venue matched', () => {
		const doc = buildEventDraft(row, { locationId: null, categoryId: null });
		expect(doc._id).toMatch(/^drafts\./);
		expect(doc.location).toHaveLength(2);
		expect(doc).not.toHaveProperty('locationRef');
		expect(doc).not.toHaveProperty('categories');
	});

	it('marks an event with no time as TBA', () => {
		expect(
			buildEventDraft(row, { locationId: null, categoryId: null }).dateStatus
		).toBe('tba');
	});

	it('references the venue and category when given', () => {
		const doc = buildEventDraft(row, { locationId: 'loc', categoryId: 'cat' });
		expect(doc.locationRef).toEqual({ _type: 'reference', _ref: 'loc' });
		expect(doc).not.toHaveProperty('location');
		expect(doc.categories?.[0]._ref).toBe('cat');
	});
});
