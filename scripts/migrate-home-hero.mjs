/**
 * One-shot: move each pHome document's `landingTitle` into a heroBlock at the
 * top of its `pageModules`.
 *
 * Why: the homepage heading was a bare string on pHome, rendered above the
 * modules by PageHome. The one page that most needs a designed opener was the
 * one page whose opener could not be edited, moved, given an image or a call to
 * action. `heroBlock` is that opener; this carries the existing text into it.
 *
 * pHome is DOCUMENT-localized, so there is one document per locale and each
 * carries its own `landingTitle` — the script simply visits every pHome it
 * finds and migrates each independently. No sibling merging, unlike the
 * merge-*-i18n scripts.
 *
 * The prepend and the `landingTitle` unset are one patch on purpose: PageHome's
 * transition tail renders the old title only while the document has no hero, so
 * a document that gained a hero but kept its title would render neither.
 *
 * Idempotent — a document that already has a heroBlock is skipped, so a re-run
 * is a no-op and a hand-authored hero is never clobbered.
 *
 * Deliberately NOT set on the new block: sectionAppearance. Its schema
 * initialValue only applies to blocks created in the Studio, and an empty
 * object here would be indistinguishable from one an editor cleared. The
 * component's own defaults cover it.
 *
 * Usage:
 *   set -a; . ./.env.local; set +a
 *   node scripts/migrate-home-hero.mjs            # dry run against dev
 *   node scripts/migrate-home-hero.mjs --execute  # write to dev
 *   SANITY_DATASET=prod node scripts/migrate-home-hero.mjs --execute
 *
 * Take a dataset export first.
 */
import { createClient } from '@sanity/client';
import { randomUUID } from 'node:crypto';

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
	// 'raw', for the reason merge-event-i18n.mjs spells out at length: under the
	// client's default `drafts` perspective a draft is overlaid onto its
	// published id, so the draft guard below silently passes while every read
	// returns draft content.
	perspective: 'raw',
});

async function main() {
	console.log(
		`\n${EXECUTE ? 'EXECUTE' : 'DRY RUN'} — dataset "${DATASET}"\n`
	);

	const drafts = await client.fetch(
		`*[_type == "pHome" && _id in path("drafts.**")]{ _id, language }`
	);
	if (drafts.length > 0) {
		console.error(
			`Found ${drafts.length} pHome draft(s). Publish or discard them first — ` +
				'this patches published documents, and an open draft would overwrite ' +
				'the result the moment someone publishes it.'
		);
		drafts.forEach((d) => console.error(`  ${d._id} (${d.language ?? '—'})`));
		process.exit(1);
	}

	const homes = await client.fetch(
		`*[_type == "pHome" && !(_id in path("drafts.**"))]{
			_id, language, landingTitle, pageModules
		}`
	);

	if (homes.length === 0) {
		console.log('No pHome documents found. Nothing to do.');
		return;
	}

	const transaction = client.transaction();
	let migrated = 0;

	for (const home of homes) {
		const label = `${home._id} (${home.language ?? '—'})`;
		const modules = Array.isArray(home.pageModules) ? home.pageModules : [];

		if (modules.some((m) => m?._type === 'heroBlock')) {
			console.log(`  skip  ${label} — already has a heroBlock`);
			continue;
		}

		const heading =
			typeof home.landingTitle === 'string' ? home.landingTitle.trim() : '';
		if (!heading) {
			console.log(`  skip  ${label} — no landingTitle to carry`);
			continue;
		}

		const hero = { _type: 'heroBlock', _key: randomUUID(), heading };

		console.log(`  move  ${label} — "${heading}" → heroBlock (slot 0)`);
		transaction.patch(home._id, (patch) =>
			patch.set({ pageModules: [hero, ...modules] }).unset(['landingTitle'])
		);
		migrated += 1;
	}

	console.log(
		`\n${migrated} of ${homes.length} pHome document(s) to migrate.`
	);

	if (migrated === 0) return;
	if (!EXECUTE) {
		console.log('Dry run — re-run with --execute to write.\n');
		return;
	}

	await transaction.commit();
	console.log('Committed.\n');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
