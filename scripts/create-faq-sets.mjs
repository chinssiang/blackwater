/**
 * One-shot: move the FAQ question list off `pFaq` and into a reusable `gFaqList`
 * set document, then point both locale pages at it.
 *
 * Runs AFTER scripts/merge-faq-i18n.mjs, never before. That script collapses the
 * two language copies of every gFaq into one document; this one builds a set of
 * references to those merged documents. Run in the other order and the set would
 * name documents the merge is about to delete, so the guard below refuses.
 *
 * Why a set document at all: `pFaq` is localized at the DOCUMENT level, so there
 * are two of them, and an inline `questions[]` array meant curating the same list
 * twice. They had already drifted — both prod pages carry the identical fifteen
 * questions in different orders. A set carries no locale, so one list serves both
 * pages, and the faqBlock page module points at sets the same way.
 *
 * Conflict policy: the two lists are expected to hold the same references. If
 * their SETS differ the script refuses rather than guessing, because dropping a
 * question from one language silently is the exact failure this change exists to
 * prevent. A difference in ORDER only is resolved in favour of the English page,
 * which is the canonical `pFaq` document, and reported in full so the operator can
 * see what moved.
 *
 * Idempotent: a `pFaq` that already has `faqSet` and no `questions` is skipped, and
 * a re-run with nothing to do reports zero changes.
 *
 * Usage:
 *   set -a; . ./.env.local; set +a
 *   node scripts/create-faq-sets.mjs            # dry run against dev
 *   node scripts/create-faq-sets.mjs --execute  # write to dev
 *   SANITY_DATASET=prod node scripts/create-faq-sets.mjs --execute
 *
 * Take a dataset export first — this rewrites documents.
 */
import { createClient } from '@sanity/client';
import { faqPreview } from './faq-preview.mjs';

const EXECUTE = process.argv.includes('--execute');
const DATASET = process.env.SANITY_DATASET || 'dev';
const TOKEN = process.env.SANITY_READ_WRITE_TOKEN;
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const SET_ID = 'gFaqList-all-questions';
const SET_TITLE = 'All questions';

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
	// 'raw' is load-bearing, not a default worth inheriting. @sanity/client
	// defaults to the `drafts` perspective, which overlays a draft onto its
	// published id — so `_id in path("drafts.**")` matches nothing, the guard
	// below silently passes, and every read returns DRAFT content.
	perspective: 'raw',
});

async function main() {
	console.log(
		`create-faq-sets → dataset "${DATASET}" ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`
	);

	// ---- Guards -------------------------------------------------------------
	const drafts = await client.fetch(
		`*[_type in ["pFaq","gFaqList"] && _id in path("drafts.**")]{_id}`
	);
	if (drafts.length) {
		console.error('Drafts exist — publish or discard them first:');
		drafts.forEach((d) => console.error('  ' + d._id));
		process.exit(1);
	}

	// The set would otherwise reference documents merge-faq-i18n.mjs deletes.
	const unmerged = await client.fetch(
		`count(*[_type == "gFaq" && !defined(question[0].language)])`
	);
	if (unmerged > 0) {
		console.error(
			`${unmerged} gFaq document(s) are still document-localized. ` +
				'Run scripts/merge-faq-i18n.mjs first — this script must come second.'
		);
		process.exit(1);
	}

	// ---- Load ---------------------------------------------------------------
	const pages = await client.fetch(
		`*[_type == "pFaq"]{_id, language, questions, faqSet}`
	);

	const pending = pages.filter((p) => Array.isArray(p.questions) && p.questions.length);
	if (!pending.length) {
		console.log('Nothing to do — no pFaq document still holds an inline list.');
		// Fetched only on this branch: on the migrating path it is always null.
		const existingSet = await client.fetch(`*[_type == "gFaqList"][0]{_id, title}`);
		if (existingSet) console.log(`  Existing set: ${existingSet._id} ("${existingSet.title}")`);
		return;
	}

	// A page already pointing at a DIFFERENT set holds no inline list, so it is
	// absent from `pending` and invisible to the conflict check below. Repointing
	// it at the canonical set would discard a deliberate editorial choice with
	// nothing in the output saying so.
	const foreign = pages.filter((p) => p.faqSet?._ref && p.faqSet._ref !== SET_ID);
	if (foreign.length) {
		console.error('\nCONFLICT: pFaq document(s) already point at a different FAQ set:');
		foreign.forEach((p) =>
			console.error(`  ${p._id} (${p.language}) → ${p.faqSet._ref}`)
		);
		console.error(
			'\nRefusing to overwrite that choice — repoint or clear them in the Studio first.'
		);
		process.exit(1);
	}

	const refsOf = (page) => (page.questions ?? []).map((q) => q._ref).filter(Boolean);
	// From `pending`, not `pages`: a page with no inline list would yield an empty
	// canonicalRefs and turn every other page's entries into a spurious "different
	// SET" conflict, reported as a membership problem the operator does not have.
	const en = pending.find((p) => (p.language || 'en') === 'en');
	const canonical = en ?? pending[0];
	const canonicalLocale = canonical.language || 'en';
	const canonicalRefs = refsOf(canonical);

	// What the transaction will actually touch: anything still holding an inline
	// list, plus anything not yet on the set. Pages already on it are left alone,
	// so this count and the write loop below cannot disagree.
	const toRepoint = pages.filter(
		(p) => pending.includes(p) || p.faqSet?._ref !== SET_ID
	);

	// ---- Conflict check -----------------------------------------------------
	// Order may differ; membership may not. A missing question is content loss.
	const ours = new Set(canonicalRefs);
	for (const page of pending) {
		if (page._id === canonical._id) continue;
		const theirRefs = refsOf(page);
		const theirs = new Set(theirRefs);
		const missing = [...ours].filter((r) => !theirs.has(r));
		const extra = [...theirs].filter((r) => !ours.has(r));
		// Length as well as membership: a Set collapses duplicates, so a page
		// listing one question twice has the same membership as the canonical
		// listing it once, and the repeat would vanish without a word.
		const sameLength = theirRefs.length === canonicalRefs.length;
		if (missing.length || extra.length || !sameLength) {
			console.error(
				`\nCONFLICT: "${page._id}" (${page.language}) lists a different SET of ` +
					`questions than the canonical "${canonical._id}".`
			);
			if (extra.length) console.error(`  only in ${page.language}: ${extra.join(', ')}`);
			if (missing.length) console.error(`  missing from ${page.language}: ${missing.join(', ')}`);
			if (!missing.length && !extra.length && !sameLength)
				console.error(
					`  same questions, but ${page.language} lists ${theirRefs.length} entries to the canonical's ${canonicalRefs.length} — it repeats one.`
				);
			console.error(
				'\nRefusing to guess which list is right — reconcile them in the Studio first.'
			);
			process.exit(1);
		}
	}

	// ---- Report -------------------------------------------------------------
	const entries = await client.fetch(`*[_id in $ids]{_id, question}`, {
		ids: canonicalRefs,
	});
	const byId = new Map(entries.map((e) => [e._id, e]));

	console.log(
		`\n  Set "${SET_TITLE}" (${SET_ID}) — ${canonicalRefs.length} question(s), ` +
			`in ${canonicalLocale} order:`
	);
	canonicalRefs.forEach((ref, i) => {
		console.log(
			`    ${String(i + 1).padStart(2)}. ${faqPreview(byId.get(ref)?.question, canonicalLocale)}`
		);
	});

	for (const page of toRepoint) {
		const theirRefs = refsOf(page);
		const moved = theirRefs.filter((r, i) => canonicalRefs[i] !== r).length;
		console.log(
			`  ${page._id} (${page.language}): ` +
				(!theirRefs.length
					? 'no inline list — will be pointed at the set'
					: `${theirRefs.length} question(s)` +
						(page._id === canonical._id
							? ' — canonical, order kept'
							: moved
								? ` — same set, ${moved} in a different position; adopting canonical order`
								: ' — identical, no change'))
		);
	}
	console.log(
		`\n1 set created, ${toRepoint.length} pFaq document(s) repointed.`
	);

	if (!EXECUTE) {
		console.log('\nDry run — nothing written. Re-run with --execute.');
		return;
	}

	// ---- Write --------------------------------------------------------------
	// One transaction: the set must exist before the pages reference it, and the
	// inline arrays must go in the same commit that replaces them.
	const tx = client.transaction();
	tx.createOrReplace({
		_id: SET_ID,
		_type: 'gFaqList',
		title: SET_TITLE,
		// Position-derived, not the referenced id: a `_key` equal to `_ref` collides
		// the moment a set is allowed to list one question twice, and Sanity shows
		// that as arrays reordering themselves rather than as a validation error.
		questions: canonicalRefs.map((ref, i) => ({
			_key: `q-${i}`,
			_type: 'reference',
			_ref: ref,
		})),
	});
	for (const page of toRepoint) {
		tx.patch(page._id, (p) =>
			p.set({ faqSet: { _type: 'reference', _ref: SET_ID } }).unset(['questions'])
		);
	}
	await tx.commit();
	console.log('Committed.');

	// ---- Post-check ---------------------------------------------------------
	const after = await client.fetch(`{
		"setSize": count(*[_id == $setId][0].questions),
		"pagesWithInlineList": count(*[_type == "pFaq" && defined(questions)]),
		"pagesWithoutSet": count(*[_type == "pFaq" && !defined(faqSet)]),
		"pagesOnOtherSets": count(*[_type == "pFaq" && faqSet._ref != $setId])
	}`, { setId: SET_ID });
	const problems = [];
	if (after.setSize !== canonicalRefs.length)
		problems.push(`set holds ${after.setSize} question(s), expected ${canonicalRefs.length}`);
	if (after.pagesWithInlineList > 0)
		problems.push(`${after.pagesWithInlineList} pFaq document(s) still hold an inline list`);
	if (after.pagesWithoutSet > 0)
		problems.push(`${after.pagesWithoutSet} pFaq document(s) have no set`);
	if (after.pagesOnOtherSets > 0)
		problems.push(`${after.pagesOnOtherSets} pFaq document(s) point at a different set`);
	if (problems.length) {
		console.error('\nPost-check FAILED:');
		problems.forEach((p) => console.error(`  ${p}`));
		process.exitCode = 1;
		return;
	}
	console.log(`Post-check clean — ${after.setSize} question(s) in one set, both pages on it.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
