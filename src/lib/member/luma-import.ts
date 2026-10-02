import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

/*
 * Loads one Luma event's guest CSV into `event_attendance` -- the importer
 * behind `scripts/import-luma-attendance.mjs`, run by hand after each event
 * (the club has no Luma Plus, so no API or webhooks).
 *
 * Imported by that script under plain `node`, which strips types but resolves
 * neither tsconfig `paths` nor extensionless relative imports. So this file
 * imports packages only; the script normalises the event URL itself with
 * `src/lib/luma.ts`, a leaf, and hands it in.
 *
 * Every row is written for EVERYONE on the list, member or not, so history is
 * waiting when someone joins (see `eventAttendance` in ./schema.ts). Three
 * rules keep that honest:
 * - only `approved` guests are written, and a guest who is no longer approved
 *   on a re-export is removed, so declined, waitlisted or cancelled guests
 *   never show a run they did not join;
 * - a re-run overwrites, so exporting again once check-in has finished fills
 *   in `checked_in_at`;
 * - a registration made before someone's erasure is refused (`attendance_erasure`).
 */

/** Runs one parameterised statement and returns its rows. */
export type Query = (
	text: string,
	params?: unknown[]
) => Promise<Record<string, unknown>[]>;

export function connect(databaseUrl: string): Query {
	const sql = neon(databaseUrl);
	return (text, params) => sql.query(text, params);
}

/** The erasure key: SHA-256 of the lowercased, trimmed email, as hex. */
export function hashEmail(email: string): string {
	return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export type LumaGuest = {
	email: string;
	registeredAt: Date | null;
	checkedInAt: Date | null;
};

/** The guest CSV, split into who attended and who is on the list but did not. */
export type LumaGuestList = {
	approved: LumaGuest[];
	/** Emails of guests whose status is anything but `approved`. */
	notApproved: string[];
};

// Luma's export column names. Checked up front, so a renamed column fails
// loudly instead of importing every guest as unregistered.
const COLUMNS = {
	email: 'email',
	registeredAt: 'created_at',
	status: 'approval_status',
	checkedInAt: 'checked_in_at',
} as const;

export function parseLumaGuestCsv(csv: string): LumaGuestList {
	const [header, ...records] = parseCsv(csv);
	if (!header) throw new Error('The CSV is empty.');
	const index = Object.fromEntries(
		Object.entries(COLUMNS).map(([key, name]) => {
			const i = header.indexOf(name);
			if (i === -1) {
				throw new Error(
					`The CSV has no "${name}" column. Columns found: ${header.join(', ')}`
				);
			}
			return [key, i];
		})
	) as Record<keyof typeof COLUMNS, number>;

	// Keyed by email: a guest can appear twice, and Postgres refuses an upsert
	// that touches one row twice. Approved wins, then the checked-in copy.
	const approved = new Map<string, LumaGuest>();
	const notApproved = new Set<string>();
	records.forEach((record, i) => {
		const line = i + 2;
		const email = (record[index.email] ?? '').trim().toLowerCase();
		if (!email) return;
		if ((record[index.status] ?? '').trim() !== 'approved') {
			notApproved.add(email);
			return;
		}
		const guest = {
			email,
			registeredAt: parseTime(record[index.registeredAt], line),
			checkedInAt: parseTime(record[index.checkedInAt], line),
		};
		const seen = approved.get(email);
		if (!seen || (!seen.checkedInAt && guest.checkedInAt)) {
			approved.set(email, guest);
		}
	});
	for (const email of approved.keys()) notApproved.delete(email);
	return { approved: [...approved.values()], notApproved: [...notApproved] };
}

function parseTime(value: string | undefined, line: number): Date | null {
	const text = (value ?? '').trim();
	if (!text) return null;
	const date = new Date(text);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Line ${line}: "${text}" is not a date.`);
	}
	return date;
}

/** RFC 4180: quoted fields, doubled quotes, CRLF or LF, a leading BOM. */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const input = text.replace(/^\uFEFF/, '');
	for (let i = 0; i < input.length; i++) {
		const c = input[i];
		if (quoted) {
			if (c === '"' && input[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && input[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field || row.length) rows.push([...row, field]);
	return rows.filter((r) => r.some((f) => f.trim()));
}

export type LumaEvent = {
	/** Already in `normalizeLumaEventUrl()`'s spelling. */
	lumaEventUrl: string;
	/** Shown only when the site has no page for the event; '' keeps the old. */
	eventName: string;
	eventStartsAt: Date | null;
};

export type ImportSummary = {
	written: number;
	removed: number;
	/** Approved guests refused because their data was erased after registering. */
	erased: number;
};

/** Writes the list, or with `execute: false` only counts what it would do. */
export async function importLumaGuests(
	query: Query,
	event: LumaEvent,
	list: LumaGuestList,
	{ execute }: { execute: boolean }
): Promise<ImportSummary> {
	const hashes = list.approved.map((g) => hashEmail(g.email));
	const erasures = new Map(
		(
			await query(
				'select email_hash, erased_at from attendance_erasure where email_hash = any($1::text[])',
				[hashes]
			)
		).map((r) => [r.email_hash as string, new Date(r.erased_at as string)])
	);
	const guests = list.approved.filter((g, i) => {
		const erasedAt = erasures.get(hashes[i]);
		// No registration time means it cannot be shown to postdate the erasure.
		return !erasedAt || (!!g.registeredAt && g.registeredAt > erasedAt);
	});
	const summary = {
		written: guests.length,
		removed: list.notApproved.length,
		erased: list.approved.length - guests.length,
	};
	if (!execute) return summary;

	if (guests.length) {
		await query(
			`insert into event_attendance
				(email, luma_event_url, event_name, event_starts_at, registered_at, checked_in_at)
			select g.email, $1, $2, $3::timestamptz, g.registered_at, g.checked_in_at
			from unnest($4::text[], $5::timestamptz[], $6::timestamptz[])
				as g(email, registered_at, checked_in_at)
			on conflict (email, luma_event_url) do update set
				event_name = coalesce(nullif(excluded.event_name, ''), event_attendance.event_name),
				event_starts_at = coalesce(excluded.event_starts_at, event_attendance.event_starts_at),
				registered_at = excluded.registered_at,
				checked_in_at = excluded.checked_in_at,
				updated_at = now()`,
			[
				event.lumaEventUrl,
				event.eventName,
				event.eventStartsAt?.toISOString() ?? null,
				guests.map((g) => g.email),
				guests.map((g) => g.registeredAt?.toISOString() ?? null),
				guests.map((g) => g.checkedInAt?.toISOString() ?? null),
			]
		);
	}
	if (list.notApproved.length) {
		await query(
			'delete from event_attendance where luma_event_url = $1 and email = any($2::text[])',
			[event.lumaEventUrl, list.notApproved]
		);
	}
	return summary;
}

/**
 * Deletes someone's attendance and records the erasure, for a privacy request
 * from a person with no account (members delete their own in Settings, which
 * does the same in auth.ts). Recorded first, so a failure between the two
 * statements leaves rows a re-run removes rather than history a re-import
 * brings back.
 */
export async function eraseAttendance(query: Query, email: string) {
	const normalized = email.trim().toLowerCase();
	await query(
		`insert into attendance_erasure (email_hash) values ($1)
		on conflict (email_hash) do update set erased_at = now()`,
		[hashEmail(normalized)]
	);
	const rows = await query(
		'delete from event_attendance where email = $1 returning 1',
		[normalized]
	);
	return rows.length;
}
