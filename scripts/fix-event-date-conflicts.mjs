/**
 * Pre-step for scripts/merge-event-i18n.mjs.
 *
 * Two events drifted apart while they were two documents, and the merge refuses
 * to guess which side is right (see the conflict guard there). This resolves
 * both, per the content owner's decision:
 *
 *   147-srp    — en 07:00 vs zh 06:30 on 25 Jul. Keep 07:00; align the zh doc.
 *   bw-154-er  — en 5 Sep with no end, zh 22 Aug with an end of 5 Sep. The event
 *                moved to 5 Sep and the new date landed in the zh doc's END
 *                field, so: start 5 Sep, no end, on both documents.
 *                Both also stored the start in Europe/Paris while the end and
 *                every other event use Asia/Taipei — corrected here too, keeping
 *                the 07:00 wall-clock (it was displaying as 13:00 in Taipei).
 *
 * Targets are spelled out in full rather than computed, so the write is exactly
 * what review sees. Idempotent: a second run reports nothing to do.
 *
 * Usage:
 *   set -a; . ./.env.local; set +a
 *   node scripts/fix-event-date-conflicts.mjs            # dry run against dev
 *   node scripts/fix-event-date-conflicts.mjs --execute
 *   SANITY_DATASET=prod node scripts/fix-event-date-conflicts.mjs --execute
 */
import { createClient } from '@sanity/client';

const EXECUTE = process.argv.includes('--execute');
const DATASET = process.env.SANITY_DATASET || 'dev';
const TOKEN = process.env.SANITY_READ_WRITE_TOKEN;
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

if (!TOKEN || !PROJECT_ID) {
	console.error(
		'Missing SANITY_READ_WRITE_TOKEN / NEXT_PUBLIC_SANITY_PROJECT_ID — source .env.local first.'
	);
	process.exit(1);
}

const client = createClient({
	projectId: PROJECT_ID,
	dataset: DATASET,
	apiVersion: '2025-02-19',
	token: TOKEN,
	useCdn: false,
	// Same reason as merge-event-i18n.mjs: @sanity/client defaults to the
	// `drafts` perspective, which overlays a draft onto its published id. That
	// makes the `!(_id in path("drafts.**"))` clause below match nothing AND
	// makes every eventDatetime/endDatetime read come from the DRAFT — so the
	// idempotency check can report "already correct" off a draft while the
	// published document still holds the conflicting date, which is exactly the
	// conflict merge-event-i18n.mjs then aborts on.
	perspective: 'raw',
});

const richDate = (local, utc) => ({
	_type: 'richDate',
	local,
	offset: 480,
	timezone: 'Asia/Taipei',
	utc,
});

/** slug → { languages, eventDatetime, clearEnd } */
const FIXES = [
	{
		slug: '147-srp',
		languages: ['zh_tw'],
		eventDatetime: richDate(
			'2026-07-25T07:00:00+08:00',
			'2026-07-24T23:00:00.000Z'
		),
		clearEnd: false,
		why: 'align zh start to the English 07:00',
	},
	{
		slug: 'bw-154-er',
		languages: ['en', 'zh_tw'],
		eventDatetime: richDate(
			'2026-09-05T07:00:00+08:00',
			'2026-09-04T23:00:00.000Z'
		),
		clearEnd: true,
		why: 'start 5 Sep 07:00 Taipei, drop the stray end date',
	},
];

async function main() {
	console.log(
		`fix-event-date-conflicts → dataset "${DATASET}" ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`
	);

	const docs = await client.fetch(
		`*[_type == "pEvent" && slug.current in $slugs && !(_id in path("drafts.**"))]{
			_id, language, "slug": slug.current, eventDatetime, endDatetime
		}`,
		{ slugs: FIXES.map((f) => f.slug) }
	);

	let tx = client.transaction();
	let pending = 0;

	for (const fix of FIXES) {
		for (const language of fix.languages) {
			const doc = docs.find(
				(d) => d.slug === fix.slug && (d.language ?? 'en') === language
			);
			if (!doc) {
				console.log(`  skip ${fix.slug} [${language}] — no such document`);
				continue;
			}
			const dateOk = doc.eventDatetime?.utc === fix.eventDatetime.utc &&
				doc.eventDatetime?.timezone === fix.eventDatetime.timezone;
			const endOk = !fix.clearEnd || !doc.endDatetime;
			if (dateOk && endOk) {
				console.log(`  ok   ${fix.slug} [${language}] — already correct`);
				continue;
			}
			console.log(
				`  fix  ${fix.slug} [${language}] ${doc.eventDatetime?.local ?? '—'} → ${fix.eventDatetime.local}${fix.clearEnd && doc.endDatetime ? ' (clearing end)' : ''}  — ${fix.why}`
			);
			let patch = client.patch(doc._id).set({ eventDatetime: fix.eventDatetime });
			if (fix.clearEnd) patch = patch.unset(['endDatetime']);
			tx = tx.patch(patch);
			pending++;
		}
	}

	if (pending === 0) {
		console.log('\nNothing to do.');
		return;
	}
	if (!EXECUTE) {
		console.log(`\n${pending} patch(es) planned. Re-run with --execute to write.`);
		return;
	}
	const result = await tx.commit();
	console.log(`\ncommitted transaction ${result.transactionId} (${pending} patches)`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
