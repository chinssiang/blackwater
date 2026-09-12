/**
 * One-shot merge: pEvent + pEvents + pEventCategory from document-level i18n
 * (one document per language, linked by translation.metadata) to field-level
 * i18n (one document per event, prose in internationalizedArrays).
 *
 * Sibling of scripts/merge-product-i18n.mjs and deliberately shaped like it —
 * same five rules:
 *   1. The `en` document is canonical and keeps its _id, so inbound references
 *      to English documents survive untouched. zh-only events (no en sibling)
 *      keep the zh document as canonical instead.
 *   2. Prose fields are wrapped as internationalizedArray items carrying BOTH
 *      `_key` and `language` (this repo's queries filter on `language ==`, and
 *      plugin v5 validates the field's presence), with the zh sibling's values
 *      appended.
 *   3. The retired `sharing` object becomes the seo fieldset
 *      (seoTitle/seoDescription/shareGraphic/disableIndex).
 *   4. Every inbound reference to a zh document is repointed to its canonical.
 *   5. zh documents and their translation.metadata documents are deleted in the
 *      same transaction, so strong-reference checks pass.
 *
 * What events need that products did not:
 *   - Siblings are grouped by their `translation.metadata` set, with slug only
 *     as the fallback for documents that have no set. Products could group by
 *     slug because their translations shared one; events cannot — two pairs
 *     (144-rr / 148-rr) were authored with a `-zhTW` slug on the zh side, so
 *     slug grouping splits them and promotes the zh document to canonical,
 *     leaving two published events per occurrence. Every zh event does belong
 *     to a set, which makes the set the reliable key.
 *   - Four `_key`-paired object arrays instead of two (stations, highlights,
 *     teamAssignments), plus statusList unioned by `eventStatus._ref`.
 *   - richDate is an OBJECT, so the conflict guard compares its utc/local/
 *     timezone members rather than the field itself.
 *   - A far wider locale-invariant surface to guard: an event is an occurrence,
 *     so its date, venue and crew can only have one value.
 *   - A genuinely zh-only event (no en sibling, none in the dataset today) is
 *     promoted to canonical, and any `-zhTW` slug suffix comes off with it —
 *     after promotion that suffix would become the permanent public URL.
 *
 * Idempotent: documents whose `title` is already an array are skipped, and a
 * re-run with nothing left to do reports zero changes.
 *
 * Usage:
 *   set -a; . ./.env.local; set +a
 *   node scripts/merge-event-i18n.mjs            # dry run against dev
 *   node scripts/merge-event-i18n.mjs --execute  # write to dev
 *   SANITY_DATASET=prod node scripts/merge-event-i18n.mjs --execute
 *
 * Take a dataset export first — this rewrites and deletes documents.
 */
import { createClient } from '@sanity/client';

const EXECUTE = process.argv.includes('--execute');
const DATASET = process.env.SANITY_DATASET || 'dev';
const TOKEN = process.env.SANITY_READ_WRITE_TOKEN;
const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

const TYPES = ['pEvent', 'pEvents', 'pEventCategory'];
const TYPES_GROQ = JSON.stringify(TYPES);

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
	// published id — so `_id in path("drafts.**")` matches nothing and the
	// "publish or discard your drafts first" guard below silently passes, while
	// every read returns DRAFT content that the merge would then publish. Under
	// 'raw' drafts are visible as `drafts.*`, so the guard fires and the load
	// step sees published documents only.
	perspective: 'raw',
});

const VALUE_TYPES = {
	string: 'internationalizedArrayStringValue',
	text: 'internationalizedArrayTextValue',
	// pEvent.content is the FULL portableText type, not portableTextSimple —
	// see the fieldTypes note in sanity.config.ts.
	pt: 'internationalizedArrayPortableTextValue',
};

/** Prose fields per document type, and how each is wrapped. */
const EVENT_PROSE = {
	title: 'string',
	subtitle: 'string',
	location: 'string',
	excerpt: 'text',
	teamNotes: 'text',
	content: 'pt',
};
/**
 * Prose inside pEvent's object arrays, keyed by field name — which is also the
 * key `IDENTITY` is looked up by, so the two can't be wired up inconsistently.
 */
const ARRAY_PROSE = {
	stations: {
		name: 'string',
		locationName: 'string',
		distance: 'string',
		questTitle: 'string',
		questInstructions: 'text',
		directionsIn: 'text',
		directionsOut: 'text',
	},
	highlights: { label: 'string', value: 'string' },
	teamAssignments: { note: 'string' },
};

/**
 * Locale-invariant scalars/objects an event can only have one of. Carried from
 * the zh sibling when the canonical lacks them; *disagreement* is caught by the
 * conflict guard before any of this runs.
 */
const EVENT_INVARIANT = [
	'format',
	'heroImage',
	'eventDatetime',
	'endDatetime',
	'dateStatus',
	'eventType',
	'distanceKm',
	'isFree',
	'locationRef',
	'locationLink',
];

/**
 * The same surface as `EVENT_INVARIANT` above, at leaf level: richDate is an
 * object, and `==` on it would not do what it looks like it does. The guard
 * projects the EVENT_INVARIANT roots (so it transfers ten fields per document
 * rather than whole documents including content and rosters) and generates one
 * comparison per path from this list, so no path can be typo'd in one of the
 * three places it used to be written out.
 */
const CONFLICT_PATHS = [
	'eventDatetime.utc',
	'eventDatetime.local',
	'eventDatetime.timezone',
	'endDatetime.utc',
	'locationRef._ref',
	'locationLink',
	'format',
	'dateStatus',
	'eventType',
	'distanceKm',
	'isFree',
	'heroImage.image.asset._ref',
];

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

const isWrapped = (v) =>
	Array.isArray(v) &&
	v.length > 0 &&
	v.every(
		(x) =>
			x &&
			typeof x === 'object' &&
			'_key' in x &&
			'language' in x &&
			'_type' in x &&
			String(x._type).startsWith('internationalizedArray')
	);

/**
 * Content the merge carried across from the zh sibling that a naive
 * canonical-only merge would have destroyed. Printed by the dry run so the
 * operator sees exactly what moves before writing.
 */
const carried = [];
function note(docId, message) {
	carried.push(`${docId}: ${message}`);
}

/**
 * Pair a canonical array item with the zh sibling's, by `_key` first and then by
 * an optional content identity (see IDENTITY below).
 *
 * `_key` alone is NOT enough. The doc-i18n duplicate flow preserves keys, so it
 * holds for siblings produced that way — but an editor who rebuilt the zh array
 * by hand produces the same logical items under fresh keys, and merge-product-
 * i18n.mjs measured exactly that on the real dataset (54 of 68 `list` pairs
 * shared no `_key` at all). Position is still never used as a fallback: it would
 * file one station's translation under another's name.
 *
 * Where an entry has a stable non-prose identity the identity fallback pairs it
 * correctly. Where it has none, the pair stays unmatched and the `ambiguous`
 * guard below refuses to guess rather than silently duplicating the array.
 */
function siblingItem(zhList, canonicalItem, identity) {
	if (!Array.isArray(zhList) || !canonicalItem) return undefined;
	if (canonicalItem._key) {
		const byKey = zhList.find((x) => x?._key && x._key === canonicalItem._key);
		if (byKey) return byKey;
	}
	if (!identity) return undefined;
	const want = identity(canonicalItem);
	if (want === undefined || want === null) return undefined;
	// Only pair on identity when it is unambiguous on BOTH sides — two "領跑 A"
	// assignments would otherwise pair arbitrarily.
	const matches = zhList.filter((x) => identity(x) === want);
	if (matches.length !== 1) return undefined;
	return matches[0];
}

/**
 * Stable, non-prose identity per array, used when `_key`s diverge. Only fields
 * that cannot differ between languages qualify — a station's `name` is the very
 * thing being translated, so it must never be used here.
 *
 * `stations` and `highlights` have no such field: every one of their members is
 * either prose or optional. They deliberately map to `undefined`, which means an
 * un-pairable entry is reported by `assertUnambiguous` rather than guessed at.
 */
const IDENTITY = {
	teamAssignments: (e) =>
		e?.role?._ref ? `${e.role._ref}::${e.group ?? ''}` : undefined,
	// stations and highlights are absent on purpose: every one of their fields is
	// either prose (the thing being translated) or optional, so no locale-invariant
	// identity exists. An unpairable entry there is reported, never guessed at.
};

/**
 * Array merges that could not be resolved without guessing. Collected rather
 * than thrown so one run reports every unpairable array; same posture as the
 * locale-invariant conflict guard below.
 */
const ambiguous = [];

/**
 * Merge an array of objects whose prose fields become i18n arrays: canonical
 * entries take their zh counterpart by `_key`, unmatched zh entries are
 * appended whole with their prose wrapped zh-only.
 */
function mergeObjectArray(canonicalList, zhList, spec, pair, zl, docId, label) {
	const base = Array.isArray(canonicalList) ? canonicalList : [];
	const zhArr = Array.isArray(zhList) ? zhList : [];
	if (base.length === 0 && zhArr.length === 0) return undefined;

	const identity = IDENTITY[label];
	const paired = new Set();
	const merged = base.map((entry) => {
		const zhEntry = siblingItem(zhArr, entry, identity);
		if (zhEntry) paired.add(zhEntry);
		const out = { ...entry };
		for (const [field, kind] of Object.entries(spec)) {
			// Idempotency: a field already wrapped by an earlier run stays put.
			out[field] = isWrapped(entry[field])
				? entry[field]
				: wrap(kind, pair(entry[field], zhEntry?.[field]));
		}
		return stripUndefined(out);
	});

	const extras = zhArr.filter((e) => !paired.has(e));
	if (extras.length && base.length > 0) {
		ambiguous.push(
			`${docId}: ${label} — ${extras.length} zh entr(y/ies) pair with nothing on the ${base.length}-entry canonical side. Appending would duplicate the array; reconcile the two by hand (give the zh entries the canonical's _keys, or clear one side) and re-run.`
		);
		return merged;
	}
	for (const entry of extras) {
		const out = { ...entry };
		for (const [field, kind] of Object.entries(spec)) {
			out[field] = isWrapped(entry[field])
				? entry[field]
				: wrap(kind, { [zl]: entry[field] });
		}
		merged.push(stripUndefined(out));
	}
	if (extras.length) {
		note(docId, `${label}: carried ${extras.length} zh-only entr(y/ies)`);
	}
	return merged;
}

/**
 * Union an array of objects whose identity is a nested reference rather than a
 * `_key` — statusList entries hold no prose, and the doc-i18n duplicate flow
 * regenerates `_key`s, so siblings carry the same status under different keys.
 * Same rule mergeList uses for gTag references in the product script.
 */
function unionByRef(canonicalList, zhList, refOf, field, docId) {
	const base = Array.isArray(canonicalList) ? canonicalList : [];
	const zhArr = Array.isArray(zhList) ? zhList : [];
	if (zhArr.length === 0) return undefined;

	// A statusItem is not just its status: it also carries its own `link`, and
	// one document can only keep one. Where both siblings reference the same
	// status but point at different URLs, the canonical's link wins by
	// necessity — but say so, because dropping a zh signup URL silently would
	// send zh_tw visitors to the English page with the dry run reporting a
	// clean merge. Compared on the link's resolvable targets only; `label` is
	// prose and already an internationalizedArray on both sides.
	const linkTarget = (e) =>
		JSON.stringify([e?.link?.href ?? null, e?.link?.internalLink?._ref ?? null]);
	const byRef = new Map(base.filter((e) => refOf(e)).map((e) => [refOf(e), e]));
	for (const zhEntry of zhArr) {
		const ref = refOf(zhEntry);
		if (!ref || !byRef.has(ref)) continue;
		const canonicalEntry = byRef.get(ref);
		if (linkTarget(zhEntry) !== linkTarget(canonicalEntry)) {
			note(
				docId,
				`${field}: kept the canonical link for status ${ref} and DROPPED the zh link ${linkTarget(zhEntry)} — one document can hold only one; re-point it by hand if the zh link was the right one`
			);
		}
	}

	const seen = new Set(base.map(refOf).filter(Boolean));
	const added = zhArr.filter((e) => {
		const ref = refOf(e);
		if (!ref || seen.has(ref)) return false;
		seen.add(ref);
		return true;
	});
	if (added.length === 0) return undefined;
	note(docId, `${field}: carried ${added.length} zh-only entr(y/ies)`);
	return [...base, ...added];
}

/**
 * Union of a plain reference array (categories) across siblings. zh events
 * reference the same English category documents today, so this is normally a
 * no-op — it exists so a zh-only category pick isn't silently dropped.
 */
function unionInvariant(canonical, zh, field, docId, idMap) {
	const map = (v) =>
		v && typeof v === 'object' && v._ref
			? { ...v, _ref: idMap?.get(v._ref) ?? v._ref }
			: v;
	const keyOf = (v) =>
		v && typeof v === 'object' ? (v._ref ?? JSON.stringify(v)) : v;
	const base = (Array.isArray(canonical[field]) ? canonical[field] : []).map(map);
	const zhArr = (Array.isArray(zh?.[field]) ? zh[field] : []).map(map);
	if (zhArr.length === 0) return undefined;

	const seen = new Set(base.map(keyOf));
	const added = zhArr.filter((v) => !seen.has(keyOf(v)));
	if (added.length === 0) return undefined;
	note(
		docId,
		`${field}: carried ${added.length} zh-only value(s) — ${added.map(keyOf).join(', ')}`
	);
	return [...base, ...added];
}

/**
 * Pairs a canonical value with its zh counterpart, keyed by language.
 * Built conditionally: for zh-only canonicals cl === zl, and a spread-style
 * `{[cl]: x, [zl]: undefined}` would overwrite the real value with nothing.
 */
function makePair(cl, zl, zh) {
	return (cVal, zVal) => {
		const out = { [cl]: cVal };
		if (zh) out[zl] = zVal;
		return out;
	};
}

/**
 * Locale-invariant values the canonical lacks but the zh sibling has. The
 * conflict guard only blocks pairs that *disagree*; a value present on one side
 * only is not a conflict, so it must be carried rather than dropped by the
 * `...canonical` spread. Real cases in the dataset: an event whose zh document
 * alone carries the venue reference, and one whose zh document alone carries a
 * status badge.
 */
function fillMissingScalars(merged, canonical, zh, fields) {
	if (!zh) return;
	for (const field of fields) {
		if (canonical[field] !== undefined && canonical[field] !== null) continue;
		if (zh[field] === undefined || zh[field] === null) continue;
		merged[field] = zh[field];
		note(canonical._id, `${field}: carried the zh-only value`);
	}
}

/** sharing{metaTitle, metaDesc, shareGraphic, disableIndex} → seo fields. */
function applySeo(merged, canonical, zh, cl, zl) {
	const pair = makePair(cl, zl, zh);
	const seoTitle = wrap(
		'string',
		pair(canonical.sharing?.metaTitle, zh?.sharing?.metaTitle)
	);
	const seoDescription = wrap(
		'text',
		pair(canonical.sharing?.metaDesc, zh?.sharing?.metaDesc)
	);
	if (seoTitle) merged.seoTitle = seoTitle;
	if (seoDescription) merged.seoDescription = seoDescription;
	if (canonical.sharing?.shareGraphic)
		merged.shareGraphic = canonical.sharing.shareGraphic;
	else if (zh?.sharing?.shareGraphic)
		merged.shareGraphic = zh.sharing.shareGraphic;
	if (canonical.sharing?.disableIndex !== undefined)
		merged.disableIndex = canonical.sharing.disableIndex;
}

function stripUndefined(obj) {
	for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
	return obj;
}

/**
 * Drop retired fields plus server-managed metadata (_rev/_system/_updatedAt —
 * createOrReplace must not echo them back). _createdAt is deliberately KEPT:
 * it is stable document identity and losing it would reorder anything that
 * falls back to creation order.
 */
function cleanSystemFields(merged) {
	stripUndefined(merged);
	delete merged.language;
	delete merged.sharing;
	delete merged._rev;
	delete merged._system;
	delete merged._updatedAt;
}

/** Wraps every prose field named in `spec` on a document body. */
function wrapProse(merged, canonical, zh, spec, pair) {
	for (const [field, kind] of Object.entries(spec)) {
		merged[field] = isWrapped(canonical[field])
			? canonical[field]
			: wrap(kind, pair(canonical[field], zh?.[field]));
	}
}

/** Builds the merged canonical document body for pEvent. */
function mergeEvent(canonical, zh, idMap) {
	const cl = canonical.language || 'en';
	const zl = zh?.language || 'zh_tw';
	const pair = makePair(cl, zl, zh);
	const docId = canonical._id;

	const merged = { ...canonical };
	wrapProse(merged, canonical, zh, EVENT_PROSE, pair);

	// startEndLocation.name is the one localized member of an otherwise
	// locale-invariant object, and the zh sibling can carry the whole object
	// when the canonical doesn't.
	const seSource = canonical.startEndLocation ?? zh?.startEndLocation;
	if (seSource) {
		if (!canonical.startEndLocation) {
			note(docId, 'startEndLocation: carried the zh-only object');
		}
		merged.startEndLocation = stripUndefined({
			...seSource,
			name: isWrapped(canonical.startEndLocation?.name)
				? canonical.startEndLocation.name
				: wrap(
						'string',
						pair(canonical.startEndLocation?.name, zh?.startEndLocation?.name)
					),
		});
	}

	for (const [field, spec] of Object.entries(ARRAY_PROSE)) {
		const out = mergeObjectArray(
			canonical[field],
			zh?.[field],
			spec,
			pair,
			zl,
			docId,
			field
		);
		if (out !== undefined) merged[field] = out;
	}

	const statusList = unionByRef(
		canonical.statusList,
		zh?.statusList,
		(e) => e?.eventStatus?._ref,
		'statusList',
		docId
	);
	if (statusList !== undefined) merged.statusList = statusList;

	const categories = unionInvariant(canonical, zh, 'categories', docId, idMap);
	if (categories) merged.categories = categories;

	fillMissingScalars(merged, canonical, zh, EVENT_INVARIANT);
	applySeo(merged, canonical, zh, cl, zl);
	cleanSystemFields(merged);
	if (merged.title === undefined) {
		throw new Error(`${docId}: merge produced no title`);
	}
	return merged;
}

/** Builds the merged canonical body for pEvents / pEventCategory. */
function mergeSimple(canonical, zh) {
	const cl = canonical.language || 'en';
	const zl = zh?.language || 'zh_tw';
	const pair = makePair(cl, zl, zh);

	const merged = { ...canonical };
	wrapProse(merged, canonical, zh, { title: 'string' }, pair);
	fillMissingScalars(merged, canonical, zh, ['categoryColor']);
	applySeo(merged, canonical, zh, cl, zl);
	cleanSystemFields(merged);
	if (merged.title === undefined) {
		throw new Error(`${canonical._id}: merge produced no title`);
	}
	return merged;
}

/** Deep-replace _ref values per idMap; dedupe reference arrays afterwards. */
function repointRefs(node, idMap) {
	let changed = false;
	const walk = (value) => {
		if (Array.isArray(value)) {
			value.forEach(walk);
			const refs = value.filter((v) => v && typeof v === 'object' && v._ref);
			if (refs.length > 1 && refs.length === value.length) {
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
 * zh-only events were authored with a `-zhTW` slug so they could coexist with an
 * English sibling that was never written. Once promoted to canonical that suffix
 * becomes the permanent public URL, so strip it — but never onto a slug another
 * event already owns.
 */
const ZH_SUFFIX = /-zh[-_]?tw$/i;
function stripZhSuffix(merged, takenSlugs, collisions) {
	const current = merged.slug?.current;
	if (!current || !ZH_SUFFIX.test(current)) return;
	const next = current.replace(ZH_SUFFIX, '');
	if (!next) return;
	if (takenSlugs.has(next)) {
		collisions.push(`${merged._id}: ${current} → ${next} (already taken)`);
		return;
	}
	takenSlugs.delete(current);
	takenSlugs.add(next);
	merged.slug = { ...merged.slug, current: next };
	note(merged._id, `slug: renamed ${current} → ${next}`);
}

async function main() {
	console.log(
		`merge-event-i18n → dataset "${DATASET}" ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`
	);

	// ---- Guards -------------------------------------------------------------
	// The three are independent, so they go out together — but they are REPORTED
	// in order, because the later ones are noise until the earlier ones are clean.
	//
	// conflicts: only *disagreement* counts. `defined()` on both sides throughout,
	// because GROQ equality is total — `null != "x"` is true, and an unguarded
	// compare would abort on a field that merely exists on one side, which is a
	// carry (fillMissingScalars handles it), not a conflict.
	const [drafts, blockingDrafts, conflicts] = await Promise.all([
		client.fetch(
			`*[_type in ${TYPES_GROQ} && _id in path("drafts.**")]{_id, _type, "slug": slug.current}`
		),
		// A draft of ANY type holding a strong reference to a zh document blocks
		// its deletion, and the repoint sweep below deliberately skips drafts — so
		// the transaction would fail at commit with nothing having named the
		// culprit.
		client.fetch(`
			*[_id in path("drafts.**") && references(*[
				_type in ${TYPES_GROQ} && language == "zh_tw"
			]._id)]{ _id, _type }
		`),
		client.fetch(`
			*[_type=="pEvent" && language=="zh_tw"]{
				"slug": slug.current,
				"en": *[_type=="pEvent" && slug.current==^.slug.current && language=="en"][0]{
					${EVENT_INVARIANT.join(', ')}
				},
				"self": @{ ${EVENT_INVARIANT.join(', ')} }
			}{
				slug,
				"fields": [
					${CONFLICT_PATHS.map(
						(path) =>
							`select(defined(self.${path}) && defined(en.${path}) && self.${path} != en.${path} => "${path}")`
					).join(',\n\t\t\t\t\t')}
				][defined(@)]
			}[count(fields) > 0]
		`),
	]);

	if (drafts.length) {
		console.error('Drafts exist — publish or discard them first:');
		drafts.forEach((d) =>
			console.error(`  ${d._type} ${d.slug ?? '(no slug)'} — ${d._id}`)
		);
		process.exit(1);
	}
	if (blockingDrafts.length) {
		console.error(
			'Drafts of other types reference zh documents that this migration deletes — discard them first:'
		);
		blockingDrafts.forEach((d) => console.error(`  ${d._type} ${d._id}`));
		process.exit(1);
	}
	if (conflicts.length) {
		console.error(
			'Sibling pairs disagree on locale-invariant fields — fix in the Studio first:'
		);
		conflicts.forEach((c) =>
			console.error(`  ${c.slug}: ${c.fields.join(', ')}`)
		);
		process.exit(1);
	}

	// ---- Load + group ---------------------------------------------------------
	// The translation.metadata set is the authoritative sibling link, so it is
	// the primary grouping key. Slug is only the fallback for documents that
	// belong to no set: two pairs (144-rr / 148-rr) carry a `-zhTW` slug on the
	// zh side, and grouping those by slug would split a single occurrence into
	// two published events. Sets may also hold a dangling entry pointing at an
	// already-deleted document — harmless, since the set itself is deleted.
	const metadataDocs = await client.fetch(
		`*[_type == "translation.metadata" && count(translations[value._ref in *[_type in ${TYPES_GROQ}]._id]) > 0]{
			_id, "refs": translations[].value._ref
		}`
	);
	const setOf = new Map();
	for (const meta of metadataDocs) {
		for (const ref of meta.refs ?? []) {
			if (ref) setOf.set(ref, meta._id);
		}
	}

	const docs = await client.fetch(
		`*[_type in ${TYPES_GROQ} && !(_id in path("drafts.**"))]`
	);
	const groups = new Map();
	for (const doc of docs) {
		const key = setOf.get(doc._id) ?? `${doc._type}:${doc.slug?.current ?? doc._id}`;
		const group = groups.get(key) ?? {};
		if (isWrapped(doc.title)) group.done = doc;
		else if (doc.language === 'zh_tw') group.zh = doc;
		else group.canonical = doc; // 'en' or legacy language-less
		groups.set(key, group);
	}

	// A merged document and an un-merged sibling on the same slug cannot be
	// folded together here: mergeEvent wraps an OLD-shape canonical, so feeding
	// it an already-wrapped one would nest arrays inside arrays. Left to the
	// zh-only fixup below it is worse than an error — `canonical` is undefined,
	// so the zh doc gets promoted, rewritten under its own _id and never
	// deleted, leaving two published documents on one slug that
	// `isUniqueAcrossType` then refuses in the Studio.
	const halfMerged = [...groups.entries()].filter(
		([, g]) => g.done && (g.zh || g.canonical)
	);
	if (halfMerged.length) {
		console.error(
			'Slug groups hold both a merged and an un-merged document — resolve before migrating:'
		);
		halfMerged.forEach(([key, g]) =>
			console.error(
				`  ${key}: merged ${g.done._id} + un-merged ${(g.zh ?? g.canonical)._id}`
			)
		);
		process.exit(1);
	}

	// zh-only groups: the zh doc IS the canonical.
	for (const group of groups.values()) {
		if (!group.canonical && group.zh) {
			group.canonical = group.zh;
			group.zh = undefined;
		}
	}

	const idMap = new Map();
	for (const group of groups.values()) {
		if (group.zh && group.canonical) idMap.set(group.zh._id, group.canonical._id);
	}

	const pending = [...groups.values()].filter((g) => g.canonical);
	const byType = (type) => pending.filter((g) => g.canonical._type === type);
	const already = [...groups.values()].filter((g) => g.done && !g.canonical).length;
	console.log(
		`groups: ${byType('pEvent').length} events, ${byType('pEvents').length} index, ${byType('pEventCategory').length} categories, ${already} already merged, ${idMap.size} zh docs to fold in`
	);

	// ---- Phase 1: merge canonicals -------------------------------------------
	const mergedDocs = pending.map((g) =>
		g.canonical._type === 'pEvent'
			? mergeEvent(g.canonical, g.zh, idMap)
			: mergeSimple(g.canonical, g.zh)
	);
	// Canonicals may themselves reference zh docs (e.g. a category pick).
	mergedDocs.forEach((d) => repointRefs(d, idMap));

	// Arrays whose two sides could not be paired without guessing. Fires in dry
	// run too, so the operator sees it before any write.
	if (ambiguous.length) {
		console.error(
			'Sibling arrays cannot be paired without duplicating them — reconcile these first:'
		);
		ambiguous.forEach((line) => console.error('  ' + line));
		process.exit(1);
	}

	// Slug rename for promoted zh-only events, against the full set of slugs
	// that will exist after the merge (zh docs being deleted don't hold theirs).
	const takenSlugs = new Set(
		mergedDocs
			.filter((d) => d._type === 'pEvent')
			.map((d) => d.slug?.current)
			.filter(Boolean)
	);
	const collisions = [];
	for (const doc of mergedDocs) {
		if (doc._type === 'pEvent') stripZhSuffix(doc, takenSlugs, collisions);
	}
	if (collisions.length) {
		console.error('Slug renames collide with existing events — resolve first:');
		collisions.forEach((c) => console.error('  ' + c));
		process.exit(1);
	}

	// ---- Phase 2: repoint every other inbound reference ----------------------
	// Skipped by _id, not by _type: an already-merged event is only covered by
	// Phase 1 if it is in `mergedDocs`, so excluding the whole type would leave
	// it pointing at a zh document nothing repoints — and the delete below then
	// fails the entire transaction on a strong reference, naming no document.
	const zhIds = [...idMap.keys()];
	const skipIds = [...mergedDocs.map((d) => d._id), ...zhIds];
	const referencing = zhIds.length
		? await client.fetch(
				`*[references($ids) && _type != "translation.metadata" && !(_id in path("drafts.**")) && !(_id in $skip)]`,
				{ ids: zhIds, skip: skipIds }
			)
		: [];
	const repointed = [];
	for (const doc of referencing) {
		if (repointRefs(doc, idMap)) {
			delete doc._rev;
			delete doc._system;
			delete doc._updatedAt;
			repointed.push(doc);
			console.log(`  repoint: ${doc._type} ${doc._id}`);
		}
	}

	// ---- Phase 3: deletions ---------------------------------------------------
	// Every set that touches these types goes, including the two holding a
	// dangling entry: with one document per event there is nothing left to link,
	// and a surviving set would keep the Studio offering a Translations view.
	const metadataIds = metadataDocs.map((d) => d._id);

	console.log(
		`plan: replace ${mergedDocs.length} canonicals, repoint ${repointed.length} referencing docs (${referencing.length} scanned), delete ${zhIds.length} zh docs + ${metadataIds.length} translation.metadata`
	);

	if (carried.length) {
		console.log(`\ncarried from zh siblings (${carried.length}):`);
		carried.forEach((line) => console.log('  ' + line));
	} else {
		console.log('\ncarried from zh siblings: none');
	}

	if (!EXECUTE) {
		for (const d of mergedDocs.slice(0, 2))
			console.log(
				'\nsample merged doc:',
				JSON.stringify(d, null, 1).slice(0, 1200)
			);
		console.log('\nDry run only — re-run with --execute to write.');
		return;
	}

	// Single transaction: strong references to zh docs are all repointed or
	// deleted within it, so constraint checks pass atomically.
	let tx = client.transaction();
	for (const d of mergedDocs) tx = tx.createOrReplace(d);
	for (const d of repointed) tx = tx.createOrReplace(d);
	for (const id of metadataIds) tx = tx.delete(id);
	for (const id of zhIds) tx = tx.delete(id);
	const result = await tx.commit();
	console.log(`committed transaction ${result.transactionId}`);

	// ---- Post-checks ----------------------------------------------------------
	const [remaining, unwrapped, suffixed] = await Promise.all([
		client.fetch(`count(*[_type in ${TYPES_GROQ} && defined(language)])`),
		client.fetch(
			`count(*[_type in ${TYPES_GROQ} && !(_id in path("drafts.**")) && !defined(title[0]._key)])`
		),
		client.fetch(`count(*[_type == "pEvent" && slug.current match "*zhTW"])`),
	]);
	console.log(
		`post-check: docs still carrying language: ${remaining}; docs with unwrapped title: ${unwrapped}; slugs still suffixed: ${suffixed}`
	);
	if (remaining > 0 || unwrapped > 0 || suffixed > 0) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
