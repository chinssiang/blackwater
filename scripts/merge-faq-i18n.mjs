/**
 * One-shot merge: gFaq from document-level i18n (one document per language,
 * linked by translation.metadata) to field-level i18n (one document per
 * question, prose in internationalizedArrays) — and, in the same pass, the
 * retirement of gFaq.order in favour of an ordered reference array on pFaq.
 *
 * Third sibling of scripts/merge-product-i18n.mjs and
 * scripts/merge-event-i18n.mjs, and much the smaller of the three: a gFaq has
 * no slug, no locale-invariant scalars two siblings could disagree about, and
 * no object arrays to pair by `_key`. Two prose fields, and that is the whole
 * document. So the conflict guard, slug handling and array-merge machinery the
 * other two need are all deliberately absent here rather than copied across.
 *
 * The rules it does share:
 *   1. The `en` document is canonical and keeps its _id, so inbound references
 *      to English documents survive untouched. A zh-only entry (none exist in
 *      either dataset today) keeps its zh document as canonical instead.
 *   2. Prose fields are wrapped as internationalizedArray items carrying BOTH
 *      `_key` and `language` — this repo's queries filter on `language ==`, and
 *      plugin v5 validates the field's presence.
 *   3. Every inbound reference to a zh document is repointed to its canonical.
 *   4. zh documents and their translation.metadata documents are deleted in the
 *      same transaction, so strong-reference checks pass.
 *
 * What this migration has that the other two did not: it must MOVE ordering
 * rather than merge it. `order` was a per-document number, so each locale had
 * its own sequence; the destination — pFaq.questions — is a per-locale array on
 * a document-level-localized page, so both sequences survive, each on its own
 * pFaq document. This has to happen BEFORE the zh documents are deleted, since
 * the zh sequence is only readable from them.
 *
 * The source data is not tidy. Prod's `order` values contain duplicates (en has
 * two 2s and two 6s; zh_tw has two 2s, 6s and 8s, and no 11) and dev's are
 * almost entirely null, so the sort below defines a deterministic result rather
 * than discovering one. The dry run prints both sequences in full — that
 * printout, not the document count, is the thing worth reading before writing.
 *
 * Idempotent: documents whose `question` is already an array are skipped, and a
 * re-run with nothing left to do reports zero changes.
 *
 * Usage:
 *   set -a; . ./.env.local; set +a
 *   node scripts/merge-faq-i18n.mjs            # dry run against dev
 *   node scripts/merge-faq-i18n.mjs --execute  # write to dev
 *   SANITY_DATASET=prod node scripts/merge-faq-i18n.mjs --execute
 *
 * Take a dataset export first — this rewrites and deletes documents.
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
	// 'raw' is load-bearing, not a default worth inheriting. @sanity/client
	// defaults to the `drafts` perspective, which overlays a draft onto its
	// published id — so `_id in path("drafts.**")` matches nothing, the "publish
	// or discard your drafts first" guard below silently passes, and every read
	// returns DRAFT content that the merge would then publish.
	perspective: 'raw',
});

const VALUE_TYPES = {
	string: 'internationalizedArrayStringValue',
	pt: 'internationalizedArrayPortableTextSimpleValue',
};

/** i18n array item in this repo's shape: _key AND language. */
function item(kind, language, value) {
	return { _key: language, _type: VALUE_TYPES[kind], language, value };
}

/**
 * Wraps one prose field from up to two sibling documents into an i18n array.
 * Skips missing/empty values; returns undefined when nothing has a value.
 */
function wrap(kind, byLanguage) {
	const items = [];
	for (const [language, value] of Object.entries(byLanguage)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value) && value.length === 0) continue;
		items.push(item(kind, language, value));
	}
	return items.length ? items : undefined;
}

/** A merged `question`: an i18n array, where pre-merge it is a plain string. */
const isWrapped = (v) =>
	Array.isArray(v) && v.length > 0 && v.every((x) => x?.language);

/** Repoint every reference that names a retired zh document at its canonical. */
function repointRefs(node, idMap) {
	let changed = false;
	const walk = (value) => {
		if (Array.isArray(value)) {
			// Whether THIS array's own members are being repointed, sampled BEFORE
			// the walk rewrites them. Only such an array can have collapsed two
			// refs onto one target, and only such an array is this migration's
			// business to dedupe — deduping every all-reference array in every
			// document it happens to open would silently drop a pre-existing
			// duplicate somewhere unrelated and write it back under this script's
			// name, with nothing in the log to attribute it.
			const repointedHere = value.some(
				(v) =>
					v &&
					typeof v === 'object' &&
					typeof v._ref === 'string' &&
					idMap.has(v._ref)
			);
			value.forEach(walk);
			if (!repointedHere) return;
			// Dedupe arrays of references that now collapse onto one target — an
			// editor who listed both language siblings in one faqList would
			// otherwise end up with the same entry twice, which pFaq/faqList both
			// reject (see the Rule.unique() note in p-faq.ts).
			if (
				value.length > 1 &&
				value.every((v) => v && typeof v === 'object' && v._ref)
			) {
				const seen = new Set();
				const deduped = value.filter((v) => {
					if (seen.has(v._ref)) return false;
					seen.add(v._ref);
					return true;
				});
				if (deduped.length !== value.length) {
					value.length = 0;
					value.push(...deduped);
					changed = true;
				}
			}
			return;
		}
		if (value && typeof value === 'object') {
			if (typeof value._ref === 'string' && idMap.has(value._ref)) {
				value._ref = idMap.get(value._ref);
				changed = true;
			}
			Object.values(value).forEach(walk);
		}
	};
	walk(node);
	return changed;
}

/**
 * System fields a createOrReplace must not carry — `_rev` above all: it is an
 * optimistic-lock assertion, so an editor saving between this script's read and
 * its commit would fail the WHOLE transaction, merges and deletes included.
 *
 * Shared by both write paths, and it stops at the system fields deliberately:
 * the canonicals additionally shed `order`/`language`, but a repointed document
 * must not — a pGeneral carrying a faqList module has a `language` of its own.
 */
function stripSystemFields(doc) {
	delete doc._rev;
	delete doc._system;
	delete doc._updatedAt;
	return doc;
}

/** `stripSystemFields` plus the two fields this migration retires. */
function cleanSystemFields(doc) {
	delete doc.order;
	delete doc.language;
	return stripSystemFields(doc);
}

/**
 * Ordering key for one locale's original documents. `order: null` sorts last
 * (dev is almost entirely null), and ties break on `_id` so prod's duplicate
 * values give the same answer on every run and in every dataset copy.
 */
function byOrderThenId(a, b) {
	// `??`, not `||`: `order: 0` is a real position, not a missing one.
	const ao = a.order ?? Infinity;
	const bo = b.order ?? Infinity;
	if (ao !== bo) return ao - bo;
	// Not localeCompare — its result is ICU-dependent, and the whole point of
	// this tiebreak is the same answer on every machine and dataset copy.
	return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
}

// Unwraps either shape: a pre-merge plain string, or a merged i18n array
// ([{language, value}]). The array case is not hypothetical — a mixed run puts
// merged documents into this printout, and it is the printout, not the counts,
// that the operator is told to read before --execute.
//
// `language` is the locale of the list being printed, and it is preferred over
// array order: an entry translated only into zh_tw would otherwise print its
// Chinese wording in the English page's list, showing the operator text that
// will not appear on the page they are checking. Falls back to any value so a
// half-translated entry still prints something identifiable.
const preview = (q, language) => {
	const raw = Array.isArray(q)
		? (
				q.find((entry) => entry?.language === language && entry?.value) ??
				q.find((entry) => entry?.value)
			)?.value
		: q;
	return (
		String(raw ?? '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 60) || '(no question)'
	);
};

async function main() {
	console.log(
		`merge-faq-i18n → dataset "${DATASET}" ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`
	);

	// ---- Guards -------------------------------------------------------------
	const drafts = await client.fetch(
		`*[_type in ["gFaq","pFaq"] && _id in path("drafts.**")]{_id}`
	);
	if (drafts.length) {
		console.error('Drafts exist — publish or discard them first:');
		drafts.forEach((d) => console.error('  ' + d._id));
		process.exit(1);
	}

	// ---- Load ---------------------------------------------------------------
	const faqs = await client.fetch(`*[_type == "gFaq"]`);
	// Matched by reference to the gFaq ids themselves, not by the `_type` of
	// `translations[0]`: a set whose FIRST entry dangles (target deleted, or
	// never published) dereferences to null, classifies as "not a gFaq set" and
	// is dropped — which would split that question's siblings into two
	// independent merged documents, exactly the duplication this migration
	// exists to remove, and orphan the set behind them.
	const metas = faqs.length
		? await client.fetch(
				`*[_type == "translation.metadata" && references($faqIds)]`,
				{ faqIds: faqs.map((d) => d._id) }
			)
		: [];
	const pFaqDocs = await client.fetch(`*[_type == "pFaq"]`);

	const byId = new Map(faqs.map((d) => [d._id, d]));
	const alreadyMerged = faqs.filter((d) => isWrapped(d.question));
	if (alreadyMerged.length === faqs.length && faqs.length > 0) {
		console.log(`Nothing to do — all ${faqs.length} gFaq documents are merged.`);
		return;
	}
	if (alreadyMerged.length) {
		console.log(
			`Skipping ${alreadyMerged.length} already-merged document(s); ${
				faqs.length - alreadyMerged.length
			} to go.`
		);
	}

	// ---- Group siblings by their translation.metadata set -------------------
	// Not by any other key: gFaq has no slug, and the metadata set is the only
	// thing that actually records which two documents are one question.
	const groups = [];
	const grouped = new Set();
	for (const meta of metas) {
		const members = (meta.translations ?? [])
			.map((t) => byId.get(t?.value?._ref))
			.filter(Boolean)
			.filter((d) => !isWrapped(d.question));
		if (!members.length) continue;
		members.forEach((d) => grouped.add(d._id));
		groups.push({ metaId: meta._id, members });
	}
	// Anything with no set of its own is its own group — it is already a single
	// document per question, it just needs its prose wrapped.
	for (const doc of faqs) {
		if (grouped.has(doc._id) || isWrapped(doc.question)) continue;
		groups.push({ metaId: null, members: [doc] });
	}

	// ---- Merge --------------------------------------------------------------
	const idMap = new Map(); // retired id -> canonical id
	const merged = [];
	const deletions = [];

	for (const group of groups) {
		const en = group.members.find((d) => d.language === 'en');
		const canonical = en ?? group.members[0];
		const others = group.members.filter((d) => d._id !== canonical._id);
		if (!en) {
			console.log(
				`  note ${canonical._id}: no en sibling — promoting "${canonical.language}" to canonical.`
			);
		}

		const questions = {};
		const answers = {};
		for (const doc of group.members) {
			const lang = doc.language || 'en';
			// Keyed by language, so a set holding two documents of the same
			// language would silently keep the last one and delete the other with
			// the rest of `others`. gFaq has no invariant scalars for the sibling
			// scripts' conflict guard to compare, but losing a whole question and
			// answer without a word is not something to discover afterwards.
			if (lang in questions) {
				console.warn(
					`  WARNING ${doc._id}: a second "${lang}" document in the same ` +
						`translation set as ${canonical._id}. Keeping the later one; ` +
						'its sibling\'s question and answer will be DELETED. Resolve ' +
						'this by hand before running with --execute.'
				);
			}
			questions[lang] = doc.question;
			answers[lang] = doc.answer;
		}

		const doc = cleanSystemFields({
			...canonical,
			question: wrap('string', questions),
			answer: wrap('pt', answers),
		});

		merged.push(doc);
		others.forEach((d) => {
			idMap.set(d._id, canonical._id);
			deletions.push(d._id);
		});
		if (group.metaId) deletions.push(group.metaId);
	}

	// A canonical can carry a reference to a document this run is deleting just
	// as an outside document can — an `answer` block's link annotation is the
	// route — so it goes through the same repoint. Nothing can reach it today
	// (`internalLink.to[]` in objects/link.ts does not list gFaq), which is
	// precisely why leaving it out would stay invisible until the day it does.
	// Runs after the loop, when idMap is complete.
	merged.forEach((doc) => repointRefs(doc, idMap));

	// ---- Build pFaq.questions, per locale, BEFORE anything is deleted -------
	// Each pFaq document keeps its own sequence: the page is document-level
	// localized, so en and zh_tw can order (or omit) independently from here on.
	//
	// Derivable ONLY on a clean first run. The sort below reads each entry's
	// `language` to decide which page it belongs to, and a merged document has
	// had that field deleted — so on a mixed run every merged entry reads as
	// `en`, and the `set` (not merge) below would rewrite zh_tw's list with
	// whatever single unmerged straggler triggered the run. That destroys the
	// Chinese FAQ page and any ordering an editor has curated since the first
	// run, which is a far worse outcome than doing nothing. The top-level guard
	// only catches the fully-merged case; this catches the mixed one.
	const pFaqPatches = [];
	const canDerivePFaqOrder = !alreadyMerged.length;
	if (!canDerivePFaqOrder) {
		console.log(
			`\n  Skipping pFaq list generation — ${alreadyMerged.length} document(s) are ` +
				'already merged, so per-locale order can no longer be derived from them. ' +
				'Any new entries need adding to each pFaq document in the Studio.'
		);
	}
	for (const page of canDerivePFaqOrder ? pFaqDocs : []) {
		// An existing list is the editor's, not this script's, to order.
		if (Array.isArray(page.questions) && page.questions.length) {
			console.log(
				`  note ${page._id}: questions already set (${page.questions.length}) — leaving it alone.`
			);
			continue;
		}
		const locale = page.language || 'en';
		const source = faqs
			.filter((d) => (d.language || 'en') === locale)
			.sort(byOrderThenId);
		const sequence = [];
		const seen = new Set();
		for (const doc of source) {
			const canonicalId = idMap.get(doc._id) ?? doc._id;
			if (seen.has(canonicalId)) continue;
			seen.add(canonicalId);
			sequence.push({ doc, canonicalId });
		}
		if (!sequence.length) {
			console.log(`  note ${page._id}: no gFaq entries for "${locale}" — leaving questions unset.`);
			continue;
		}
		const refs = sequence.map(({ canonicalId }) => ({
			_key: canonicalId,
			_type: 'reference',
			_ref: canonicalId,
		}));
		pFaqPatches.push({ id: page._id, locale, refs });
		console.log(`\n  pFaq "${page._id}" (${locale}) — ${refs.length} question(s), in this order:`);
		sequence.forEach(({ doc }, i) => {
			console.log(
				`    ${String(i + 1).padStart(2)}. [order ${doc.order ?? '—'}] ${preview(
					doc.question,
					locale
				)}`
			);
		});
	}

	// ---- Repoint inbound references ----------------------------------------
	const inbound = idMap.size
		? await client.fetch(`*[references($ids) && !(_id in $ids) && _type != "translation.metadata"]`, {
				ids: [...idMap.keys()],
			})
		: [];
	const repointed = [];
	for (const doc of inbound) {
		if (!repointRefs(doc, idMap)) continue;
		stripSystemFields(doc);
		repointed.push(doc);
		// Named, not just counted — this is the one class of write the dry run
		// would otherwise report as a bare number, on documents the operator did
		// not ask to touch.
		console.log(`  repoint: ${doc._type} ${doc._id}`);
	}

	// ---- Report -------------------------------------------------------------
	console.log(
		`\n${merged.length} merged document(s), ${deletions.length} deletion(s), ` +
			`${repointed.length} document(s) repointed, ${pFaqPatches.length} pFaq list(s) written.`
	);

	if (!EXECUTE) {
		console.log('\nDry run — nothing written. Re-run with --execute.');
		return;
	}

	// ---- Write --------------------------------------------------------------
	// One transaction: the zh documents and their metadata must go in the same
	// commit that stops anything referencing them, or strong-reference checks
	// reject the deletes.
	const tx = client.transaction();
	merged.forEach((doc) => tx.createOrReplace(doc));
	repointed.forEach((doc) => tx.createOrReplace(doc));
	pFaqPatches.forEach(({ id, refs }) =>
		tx.patch(id, (p) => p.set({ questions: refs }))
	);
	deletions.forEach((id) => tx.delete(id));
	await tx.commit();
	console.log('Committed.');

	// Post-check, as both sibling scripts do: the transaction reporting success
	// is not the same as the dataset being in the shape the app's queries expect,
	// and this is the last moment anyone is looking.
	const leftovers = await client.fetch(`{
		"unmerged": count(*[_type == "gFaq" && defined(question) && !defined(question[0].language)]),
		"questionMissingEverywhere": count(*[_type == "gFaq" && !defined(question)]),
		"staleFields": count(*[_type == "gFaq" && (defined(order) || defined(language))]),
		"orphanMetadata": count(*[_type == "translation.metadata" && references($faqIds)])
	}`, { faqIds: merged.map((d) => d._id) });
	const problems = Object.entries(leftovers).filter(([, n]) => n > 0);
	if (problems.length) {
		console.error('\nPost-check FAILED:');
		problems.forEach(([k, n]) => console.error(`  ${k}: ${n}`));
		process.exitCode = 1;
		return;
	}
	console.log('Post-check clean.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
