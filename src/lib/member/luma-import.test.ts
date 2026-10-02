import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
	type LumaEvent,
	type Query,
	eraseAttendance,
	hashEmail,
	importLumaGuests,
	parseLumaGuestCsv,
} from './luma-import';

const HEADER = 'api_id,name,email,created_at,approval_status,checked_in_at';

const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');

describe('parseLumaGuestCsv', () => {
	it('reads approved guests, lowercased, with their times', () => {
		const list = parseLumaGuestCsv(
			csv(
				'g1,"Lin, Mei",Mei@Example.com,2026-09-01T10:00:00Z,approved,2026-09-20T07:05:00Z'
			)
		);
		expect(list).toEqual({
			approved: [
				{
					email: 'mei@example.com',
					registeredAt: new Date('2026-09-01T10:00:00Z'),
					checkedInAt: new Date('2026-09-20T07:05:00Z'),
				},
			],
			notApproved: [],
		});
	});

	it('leaves the check-in empty for a no-show', () => {
		const list = parseLumaGuestCsv(
			csv('g1,A,a@example.com,2026-09-01T10:00:00Z,approved,')
		);
		expect(list.approved[0].checkedInAt).toBeNull();
	});

	it('lists declined, waitlisted and invited guests apart', () => {
		const list = parseLumaGuestCsv(
			csv(
				'g1,A,a@example.com,2026-09-01T10:00:00Z,declined,',
				'g2,B,b@example.com,2026-09-01T10:00:00Z,waitlist,',
				'g3,C,c@example.com,2026-09-01T10:00:00Z,invited,'
			)
		);
		expect(list.approved).toEqual([]);
		expect(list.notApproved).toEqual([
			'a@example.com',
			'b@example.com',
			'c@example.com',
		]);
	});

	it('keeps one row per email, preferring the approved, checked-in one', () => {
		const list = parseLumaGuestCsv(
			csv(
				'g1,A,a@example.com,2026-09-01T10:00:00Z,declined,',
				'g2,A,a@example.com,2026-09-02T10:00:00Z,approved,',
				'g3,A,A@example.com,2026-09-03T10:00:00Z,approved,2026-09-20T07:00:00Z'
			)
		);
		expect(list.notApproved).toEqual([]);
		expect(list.approved).toHaveLength(1);
		expect(list.approved[0].checkedInAt).not.toBeNull();
	});

	it('reads quoted fields, doubled quotes, CRLF and a BOM', () => {
		const list = parseLumaGuestCsv(
			`\uFEFF${HEADER}\r\ng1,"Say ""hi""\nthere",a@example.com,,approved,\r\n`
		);
		expect(list.approved.map((g) => g.email)).toEqual(['a@example.com']);
	});

	it('fails on a missing column, naming the ones it found', () => {
		expect(() => parseLumaGuestCsv('name,email\nA,a@example.com')).toThrow(
			/no "created_at" column. Columns found: name, email/
		);
	});

	it('fails on a time it cannot read, naming the line', () => {
		expect(() =>
			parseLumaGuestCsv(csv('g1,A,a@example.com,yesterday,approved,'))
		).toThrow(/Line 2: "yesterday"/);
	});
});

describe('importLumaGuests', () => {
	let pg: PGlite;
	let query: Query;
	beforeAll(async () => {
		pg = new PGlite();
		await migrate(drizzle(pg), { migrationsFolder: 'drizzle' });
		query = async (text, params) =>
			(await pg.query(text, params)).rows as never;
	});
	beforeEach(async () => {
		await pg.exec('truncate event_attendance, attendance_erasure');
	});

	const event: LumaEvent = {
		lumaEventUrl: 'https://luma.com/sunday-run',
		eventName: 'Sunday Run',
		eventStartsAt: new Date('2026-09-20T07:00:00+08:00'),
	};
	const rows = async () =>
		(
			await pg.query<{ email: string; checked_in_at: Date | null }>(
				'select email, checked_in_at from event_attendance order by email'
			)
		).rows;
	const run = (text: string, execute = true) =>
		importLumaGuests(query, event, parseLumaGuestCsv(text), { execute });

	it('writes every approved guest, member or not', async () => {
		const summary = await run(
			csv(
				'g1,A,a@example.com,2026-09-01T10:00:00Z,approved,2026-09-20T07:05:00Z',
				'g2,B,b@example.com,2026-09-01T10:00:00Z,approved,'
			)
		);
		expect(summary).toEqual({ written: 2, removed: 0, erased: 0 });
		expect((await rows()).map((r) => r.email)).toEqual([
			'a@example.com',
			'b@example.com',
		]);
	});

	it('writes nothing on a dry run', async () => {
		const summary = await run(
			csv('g1,A,a@example.com,2026-09-01T10:00:00Z,approved,'),
			false
		);
		expect(summary.written).toBe(1);
		expect(await rows()).toEqual([]);
	});

	it('fills in check-ins when the CSV is exported again', async () => {
		await run(csv('g1,A,a@example.com,2026-09-01T10:00:00Z,approved,'));
		await run(
			csv(
				'g1,A,a@example.com,2026-09-01T10:00:00Z,approved,2026-09-20T07:05:00Z'
			)
		);
		expect(await rows()).toEqual([
			{
				email: 'a@example.com',
				checked_in_at: new Date('2026-09-20T07:05:00Z'),
			},
		]);
	});

	it('removes a guest who is no longer approved', async () => {
		await run(csv('g1,A,a@example.com,2026-09-01T10:00:00Z,approved,'));
		const summary = await run(
			csv('g1,A,a@example.com,2026-09-01T10:00:00Z,declined,')
		);
		expect(summary.removed).toBe(1);
		expect(await rows()).toEqual([]);
	});

	it('keeps the stored name when a re-run gives none', async () => {
		await run(csv('g1,A,a@example.com,2026-09-01T10:00:00Z,approved,'));
		await importLumaGuests(
			query,
			{ ...event, eventName: '' },
			parseLumaGuestCsv(
				csv('g1,A,a@example.com,2026-09-01T10:00:00Z,approved,')
			),
			{ execute: true }
		);
		const { rows: names } = await pg.query(
			'select event_name from event_attendance'
		);
		expect(names).toEqual([{ event_name: 'Sunday Run' }]);
	});

	describe('after an erasure', () => {
		beforeEach(async () => {
			await run(csv('g1,A,a@example.com,2026-09-01T10:00:00Z,approved,'));
			await eraseAttendance(query, 'A@Example.com');
			await pg.query('update attendance_erasure set erased_at = $1', [
				'2026-09-10T00:00:00Z',
			]);
		});

		it('deletes the rows', async () => {
			expect(await rows()).toEqual([]);
		});

		it('refuses an old registration on a re-import', async () => {
			const summary = await run(
				csv('g1,A,a@example.com,2026-09-01T10:00:00Z,approved,')
			);
			expect(summary).toEqual({ written: 0, removed: 0, erased: 1 });
			expect(await rows()).toEqual([]);
		});

		it('accepts a registration made after it', async () => {
			await run(csv('g1,A,a@example.com,2026-10-01T10:00:00Z,approved,'));
			expect((await rows()).map((r) => r.email)).toEqual(['a@example.com']);
		});

		it('refuses a registration with no time', async () => {
			const summary = await run(csv('g1,A,a@example.com,,approved,'));
			expect(summary.erased).toBe(1);
		});

		it('matches the hash auth.ts records', async () => {
			const { rows: hashes } = await pg.query(
				'select email_hash from attendance_erasure'
			);
			expect(hashes).toEqual([{ email_hash: hashEmail('a@example.com') }]);
		});
	});
});
