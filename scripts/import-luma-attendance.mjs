/**
 * Loads a Luma event's guest list into `event_attendance`, which is what
 * /account/history shows. Run it after each event, once the crew has finished
 * checking people in. Re-running it on a newer export is safe and is how a
 * late check-in or a cancellation is picked up.
 *
 * Get the CSV from Luma: open the event -> Manage -> Guests -> download CSV.
 * `--url` is the event's PUBLIC link (lu.ma/... or luma.com/...), the same one
 * pasted into the event's "Luma URL" in the Studio -- not the manage page.
 * `--name` and `--starts` are shown only for events the site has no page for.
 *
 * Dry run by default: prints what it would write. Add --execute to write.
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/import-luma-attendance.mjs \
 *     --url https://lu.ma/abc123 --name "Sunday Long Run" \
 *     --starts 2026-09-20T07:00+08:00 guests.csv [--execute]
 *
 * A privacy request from someone with NO account (members use Settings ->
 * Delete account) erases their history and stops a re-import restoring it:
 *   node --experimental-strip-types --no-warnings scripts/import-luma-attendance.mjs \
 *     --erase someone@example.com [--execute]
 *
 * Reads DATABASE_URL from the shell or .env.local -- check which database it
 * points at before adding --execute.
 */
import { normalizeLumaEventUrl } from '../src/lib/luma.ts';
import {
	connect,
	eraseAttendance,
	importLumaGuests,
	parseLumaGuestCsv,
} from '../src/lib/member/luma-import.ts';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
	allowPositionals: true,
	options: {
		url: { type: 'string' },
		name: { type: 'string', default: '' },
		starts: { type: 'string' },
		erase: { type: 'string' },
		execute: { type: 'boolean', default: false },
	},
});

try {
	process.loadEnvFile('.env.local');
} catch {
	// No .env.local: the shell must provide DATABASE_URL.
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail('DATABASE_URL is not set (shell or .env.local).');
const query = connect(databaseUrl);
const host = new URL(databaseUrl).hostname;
const mode = values.execute ? 'WRITING' : 'DRY RUN (add --execute to write)';

if (values.erase) {
	if (!values.erase.includes('@')) fail(`"${values.erase}" is not an email.`);
	console.log(`${mode} -- database ${host}`);
	if (values.execute) {
		const removed = await eraseAttendance(query, values.erase);
		console.log(
			`Erased ${values.erase}: ${removed} attendance row(s) deleted.`
		);
	} else {
		console.log(`Would erase ${values.erase} and block re-imports of it.`);
	}
	process.exit(0);
}

const [file, ...extra] = positionals;
if (!file || extra.length) fail('Pass exactly one guest CSV file.');
if (!values.url) fail("Pass --url, the event's public Luma link.");
const lumaEventUrl = normalizeLumaEventUrl(values.url);
if (!lumaEventUrl) {
	fail(
		`"${values.url}" is not a public Luma event link (lu.ma/... or luma.com/...).`
	);
}
let eventStartsAt = null;
if (values.starts) {
	eventStartsAt = new Date(values.starts);
	if (Number.isNaN(eventStartsAt.getTime())) {
		fail(
			`--starts "${values.starts}" is not a date, e.g. 2026-09-20T07:00+08:00`
		);
	}
}

const list = parseLumaGuestCsv(readFileSync(file, 'utf8'));
const summary = await importLumaGuests(
	query,
	{ lumaEventUrl, eventName: values.name.trim(), eventStartsAt },
	list,
	{ execute: values.execute }
);
const checkedIn = list.approved.filter((g) => g.checkedInAt).length;

console.log(`${mode} -- database ${host}`);
console.log(`Event: ${lumaEventUrl}`);
console.log(
	`${summary.written} guest(s) ${values.execute ? 'written' : 'to write'} (${checkedIn} checked in among the approved)`
);
console.log(
	`${summary.removed} not approved (declined, waitlisted, invited...) ${values.execute ? 'removed' : 'to remove'} if present`
);
if (summary.erased) {
	console.log(
		`${summary.erased} skipped: their data was erased at their request`
	);
}

function fail(message) {
	console.error(message);
	process.exit(1);
}
