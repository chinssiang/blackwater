/**
 * One-shot merge: pProduct + pProductCollection from document-level i18n
 * (one document per language, linked by translation.metadata) to field-level
 * i18n (one document per product, prose in internationalizedArrays).
 *
 * Per slug group:
 *   1. The `en` document is canonical and keeps its _id, so inbound references
 *      to English documents survive untouched. zh-only products (no en
 *      sibling) keep the zh document as canonical instead.
 *   2. Prose fields are wrapped as internationalizedArray items carrying BOTH
 *      `_key` and `language` (this repo's queries filter on `language ==`, and
 *      plugin v5 validates the field's presence) with the zh sibling's values
 *      appended.
 *   3. The retired `sharing` object becomes the seo fieldset
 *      (seoTitle/seoDescription/shareGraphic/disableIndex).
 *   4. Every inbound reference to a zh document is repointed to its canonical
 *      (relatedProducts, collection products, settingsCart picks, menu links,
 *      PT annotations), with reference arrays deduped afterwards.
 *   5. zh documents and their translation.metadata documents are deleted in
 *      the same transaction, so strong-reference checks pass.
 *
 * Idempotent: documents whose `title` is already an array are skipped, and a
 * re-run with nothing left to do reports zero changes.
 *
 * Usage:
 *   set -a; . ./.env.local; set +a
 *   node scripts/merge-product-i18n.mjs            # dry run against dev
 *   node scripts/merge-product-i18n.mjs --execute  # write to dev
 *   SANITY_DATASET=prod node scripts/merge-product-i18n.mjs --execute
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
	// 'raw' is load-bearing. @sanity/client defaults to the `drafts` perspective,
	// which overlays a draft onto its published id — so `_id in path("drafts.**")`
	// matches nothing, the "publish or discard your drafts first" guard below
	// silently passes, and every read returns DRAFT content that the merge would
	// then publish. (Found while writing scripts/merge-event-i18n.mjs, where the
	// dataset actually had stale drafts; back-ported here because this migration
	// has not run against prod yet.)
	perspective: 'raw',
});

const VALUE_TYPES = {
	string: 'internationalizedArrayStringValue',
	text: 'internationalizedArrayTextValue',
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

const isWrapped = (v) =>
	Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === 'object' && '_key' in x && 'language' in x && '_type' in x && String(x._type).startsWith('internationalizedArray'));

/**
 * Content the merge carried across from the zh sibling that a naive
 * canonical-only merge would have destroyed. Printed by the dry run so the
 * operator sees exactly what moves before writing — silence here used to mean
 * "nothing to do" when it actually meant "dropped it".
 */
const carried = [];
function note(docId, message) {
	carried.push(`${docId}: ${message}`);
}

/**
 * Pair a canonical array item with the zh sibling's by `_key`. Position is NOT
 * used as a fallback: the doc-i18n duplicate flow preserves `_key`s, so a
 * missing key means the editor built that zh item independently, and pairing it
 * positionally would file one measurement's translation under another's label.
 * Unmatched zh items are appended instead (see mergeList / mergeMetadata).
 */
function siblingItem(zhList, canonicalItem) {
	if (!Array.isArray(zhList) || !canonicalItem?._key) return undefined;
	return zhList.find((x) => x?._key && x._key === canonicalItem._key);
}

/** zh entries with no `_key` counterpart in the canonical list. */
function unmatchedZh(canonicalList, zhList) {
	if (!Array.isArray(zhList)) return [];
	const keys = new Set(
		(Array.isArray(canonicalList) ? canonicalList : [])
			.map((e) => e?._key)
			.filter(Boolean)
	);
	return zhList.filter((e) => !e?._key || !keys.has(e._key));
}

/**
 * Merge a `list` array. The two member kinds need different identities:
 *
 * - `reference` (gTag) — identity is `_ref`. `_key`s are NOT comparable: the
 *   doc-i18n duplicate flow regenerates them, so siblings hold the same tags
 *   under different keys and often in a different order (measured on the real
 *   dataset: 54 of 68 list pairs share no `_key` at all, yet 40 of them carry
 *   an identical set of `_ref`s). Union by `_ref` — matching by key or position
 *   would duplicate every tag on those 40.
 * - `textItem` — prose, so its text becomes an i18n array, paired by `_key`.
 *   Unmatched zh items are appended zh-only rather than dropped. (No textItem
 *   exists in the dataset today; this path is here so the shape stays correct.)
 */
function mergeList(canonicalList, zhList, canonicalLang, zhLang, docId, label) {
	const base = Array.isArray(canonicalList) ? canonicalList : [];
	const zhArr = Array.isArray(zhList) ? zhList : [];
	if (base.length === 0 && zhArr.length === 0) return canonicalList;

	const merged = base.map((entry) => {
		if (entry?._type !== 'textItem') return entry;
		if (isWrapped(entry.text)) return entry;
		const zh = siblingItem(zhArr, entry);
		return {
			...entry,
			text: wrap('string', {
				[canonicalLang]: entry.text,
				...(zh?._type === 'textItem' ? { [zhLang]: zh.text } : {}),
			}),
		};
	});

	const haveRefs = new Set(
		base.filter((e) => e?._type === 'reference').map((e) => e._ref)
	);
	const baseKeys = new Set(base.map((e) => e?._key).filter(Boolean));
	let added = 0;
	for (const entry of zhArr) {
		if (entry?._type === 'reference') {
			if (!entry._ref || haveRefs.has(entry._ref)) continue;
			haveRefs.add(entry._ref);
			merged.push(entry);
			added++;
		} else if (entry?._type === 'textItem' && !baseKeys.has(entry._key)) {
			merged.push(
				isWrapped(entry.text)
					? entry
					: { ...entry, text: wrap('string', { [zhLang]: entry.text }) }
			);
			added++;
		}
	}
	if (added) note(docId, `${label}: carried ${added} zh-only item(s)`);
	return merged;
}

/**
 * Merge the `metadata[]` array of objects. Same rule as mergeList: canonical
 * entries take their zh counterpart by `_key`, unmatched zh entries are
 * appended whole (their prose wrapped zh-only), and a zh array with no
 * canonical counterpart at all is carried over rather than lost.
 */
function mergeMetadata(canonical, zh, pair, cl, zl, docId) {
	const base = Array.isArray(canonical.metadata) ? canonical.metadata : [];
	const zhList = Array.isArray(zh?.metadata) ? zh.metadata : [];
	if (base.length === 0 && zhList.length === 0) return undefined;

	const clean = (out) => {
		if (out.richText === undefined) delete out.richText;
		if (out.title === undefined) delete out.title;
		if (out.list === undefined) delete out.list;
		return out;
	};

	const merged = base.map((entry) => {
		const zhEntry = siblingItem(zhList, entry);
		return clean({
			...entry,
			title: wrap('string', pair(entry.title, zhEntry?.title)),
			richText: wrap('pt', pair(entry.richText, zhEntry?.richText)),
			list: mergeList(
				entry.list,
				zhEntry?.list,
				cl,
				zl,
				docId,
				`metadata[${entry._key}].list`
			),
		});
	});

	const extras = unmatchedZh(base, zhList);
	for (const entry of extras) {
		merged.push(
			clean({
				...entry,
				title: wrap('string', { [zl]: entry.title }),
				richText: wrap('pt', { [zl]: entry.richText }),
				list: mergeList(
					undefined,
					entry.list,
					zl,
					zl,
					docId,
					`metadata[${entry._key}].list`
				),
			})
		);
	}
	if (extras.length) {
		note(docId, `metadata: carried ${extras.length} zh-only entr(y/ies)`);
	}
	return merged;
}

/**
 * Union of a locale-invariant array (badge, categories, brands,
 * relatedProducts) across siblings. One document can only hold one set, and
 * dropping the zh side silently loses editor intent — e.g. a badge set only on
 * the translation. Values already equal on both sides are unaffected.
 */
function unionInvariant(canonical, zh, field, docId, idMap) {
	const map = (v) =>
		v && typeof v === 'object' && v._ref
			? { ...v, _ref: idMap?.get(v._ref) ?? v._ref }
			: v;
	const keyOf = (v) => (v && typeof v === 'object' ? (v._ref ?? JSON.stringify(v)) : v);
	const base = (Array.isArray(canonical[field]) ? canonical[field] : []).map(map);
	const zhArr = (Array.isArray(zh?.[field]) ? zh[field] : []).map(map);
	if (zhArr.length === 0) return undefined;

	const seen = new Set(base.map(keyOf));
	const added = zhArr.filter((v) => !seen.has(keyOf(v)));
	if (added.length === 0) return undefined;
	note(docId, `${field}: carried ${added.length} zh-only value(s) — ${added.map((v) => keyOf(v)).join(', ')}`);
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

/** Builds the merged canonical document body for pProduct. */
function mergeProduct(canonical, zh, idMap) {
	const cl = canonical.language || 'en';
	const zl = zh?.language || 'zh_tw';
	const pair = makePair(cl, zl, zh);
	const two = (field) => pair(canonical[field], zh?.[field]);

	const merged = {
		...canonical,
		title: wrap('string', two('title')),
		excerpt: wrap('text', two('excerpt')),
		content: wrap('pt', two('content')),
		whyUseIt: wrap('pt', two('whyUseIt')),
		whoIsItFor: wrap('pt', two('whoIsItFor')),
	};

	// The zh sibling can carry this section when the canonical doesn't.
	const whenSource = canonical.whenReachForIt ?? zh?.whenReachForIt;
	if (whenSource) {
		if (!canonical.whenReachForIt) {
			note(canonical._id, 'whenReachForIt: carried the zh-only section');
		}
		merged.whenReachForIt = {
			...whenSource,
			richText: wrap(
				'pt',
				pair(canonical.whenReachForIt?.richText, zh?.whenReachForIt?.richText)
			),
			list: mergeList(
				canonical.whenReachForIt?.list,
				zh?.whenReachForIt?.list,
				cl,
				zl,
				canonical._id,
				'whenReachForIt.list'
			),
		};
		if (merged.whenReachForIt.richText === undefined)
			delete merged.whenReachForIt.richText;
		if (merged.whenReachForIt.list === undefined)
			delete merged.whenReachForIt.list;
	}

	const metadata = mergeMetadata(canonical, zh, pair, cl, zl, canonical._id);
	if (metadata !== undefined) merged.metadata = metadata;

	// Locale-invariant arrays and scalars: fill or union from the zh sibling
	// rather than letting the `...canonical` spread drop what only it carries.
	for (const field of ['badge', 'categories', 'brands', 'relatedProducts']) {
		const union = unionInvariant(canonical, zh, field, canonical._id, idMap);
		if (union) merged[field] = union;
	}
	fillMissingScalars(merged, canonical, zh, [
		'price',
		'purchaseLink',
		'soldOut',
		'mainImage',
		'sizeChart',
		'shopify',
	]);

	applySeo(merged, canonical, zh, cl, zl);
	cleanSystemFields(merged);
	if (merged.title === undefined) {
		throw new Error(`${canonical._id}: merge produced no title`);
	}
	return merged;
}

/**
 * Locale-invariant scalars the canonical lacks but the zh sibling has. The
 * conflict guard only blocks pairs that *disagree*; a value present on one side
 * only is not a conflict, so it must be carried rather than dropped by the
 * `...canonical` spread.
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

/**
 * Drop retired fields plus server-managed metadata (_rev/_system/_updatedAt —
 * createOrReplace must not echo them back). _createdAt is deliberately KEPT:
 * listings order by it, and losing it would reshuffle the product index.
 */
function cleanSystemFields(merged) {
	stripUndefined(merged);
	delete merged.language;
	delete merged.sharing;
	delete merged._rev;
	delete merged._system;
	delete merged._updatedAt;
}

/** Builds the merged canonical body for pProductCollection. */
function mergeCollection(canonical, zh, productIdMap) {
	const cl = canonical.language || 'en';
	const zl = zh?.language || 'zh_tw';

	// Union of both product lists, mapped to canonical ids, deduped, en order
	// first. _keys regenerate deterministically from the target id.
	const seen = new Set();
	const products = [];
	for (const ref of [
		...(canonical.products ?? []),
		...(zh?.products ?? []),
	]) {
		const target = productIdMap.get(ref?._ref) ?? ref?._ref;
		if (!target || seen.has(target)) continue;
		seen.add(target);
		products.push({ ...ref, _ref: target, _key: `p-${target}` });
	}

	const pair = makePair(cl, zl, zh);
	const merged = {
		...canonical,
		title: wrap('string', pair(canonical.title, zh?.title)),
		description: wrap('text', pair(canonical.description, zh?.description)),
		products,
	};
	if (products.length > (canonical.products ?? []).length) {
		note(
			canonical._id,
			`products: carried ${products.length - (canonical.products ?? []).length} zh-only pick(s)`
		);
	}
	fillMissingScalars(merged, canonical, zh, ['coverImage']);
	applySeo(merged, canonical, zh, cl, zl);
	cleanSystemFields(merged);
	return merged;
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
}

/** Deep-replace _ref values per idMap; dedupe reference arrays afterwards. */
function repointRefs(node, idMap) {
	let changed = false;
	const walk = (value) => {
		if (Array.isArray(value)) {
			value.forEach(walk);
			// Dedupe arrays of references that now collapse onto one target.
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

async function main() {
	console.log(
		`merge-product-i18n → dataset "${DATASET}" ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`
	);

	// ---- Guards -------------------------------------------------------------
	const drafts = await client.fetch(
		`*[_type in ["pProduct","pProductCollection"] && _id in path("drafts.**")]{_id}`
	);
	if (drafts.length) {
		console.error('Drafts exist — publish or discard them first:');
		drafts.forEach((d) => console.error('  ' + d._id));
		process.exit(1);
	}

	// A draft of ANY type holding a strong reference to a zh document blocks its
	// deletion, and the repoint sweep below deliberately skips drafts — so the
	// transaction would fail at commit with nothing having named the culprit.
	// Cheap to check up front, and the operator can discard the draft.
	const blockingDrafts = await client.fetch(`
		*[_id in path("drafts.**") && references(*[
			_type in ["pProduct","pProductCollection"] && language == "zh_tw"
		]._id)]{ _id, _type }
	`);
	if (blockingDrafts.length) {
		console.error(
			'Drafts of other types reference zh documents that this migration deletes — discard them first:'
		);
		blockingDrafts.forEach((d) => console.error(`  ${d._type} ${d._id}`));
		process.exit(1);
	}

	// Only *disagreement* is a conflict. `defined()` on both sides throughout:
	// GROQ equality is total, so `null != "x"` is true and an unguarded compare
	// would abort on a field that merely exists on one side — which is not a
	// conflict but a carry (fillMissingScalars handles it).
	const conflicts = await client.fetch(`
		*[_type=="pProduct" && language=="zh_tw"]{
			"slug": slug.current,
			"en": *[_type=="pProduct" && slug.current==^.slug.current && language=="en"][0],
			"self": @
		}{
			slug,
			"hasEn": defined(en),
			"bad": defined(en) && (
				(defined(self.price) && defined(en.price) && self.price != en.price) ||
				(defined(self.soldOut) && defined(en.soldOut) && self.soldOut != en.soldOut) ||
				(defined(self.purchaseLink) && defined(en.purchaseLink) && self.purchaseLink != en.purchaseLink) ||
				(defined(self.shopify.handle) && defined(en.shopify.handle) && self.shopify.handle != en.shopify.handle) ||
				(defined(self.mainImage.image.asset._ref) && defined(en.mainImage.image.asset._ref) && self.mainImage.image.asset._ref != en.mainImage.image.asset._ref) ||
				(defined(self.sizeChart._ref) && defined(en.sizeChart._ref) && self.sizeChart._ref != en.sizeChart._ref)
			)
		}[bad]
	`);
	if (conflicts.length) {
		console.error('Sibling pairs disagree on locale-invariant fields — fix in Studio first:');
		conflicts.forEach((c) => console.error('  ' + c.slug));
		process.exit(1);
	}

	// ---- Load + group ---------------------------------------------------------
	const docs = await client.fetch(
		`*[_type in ["pProduct","pProductCollection"] && !(_id in path("drafts.**"))]`
	);
	const groups = new Map();
	for (const doc of docs) {
		const key = `${doc._type}:${doc.slug?.current ?? doc._id}`;
		const group = groups.get(key) ?? {};
		if (isWrapped(doc.title)) group.done = doc;
		else if (doc.language === 'zh_tw') group.zh = doc;
		else group.canonical = doc; // 'en' or legacy language-less
		groups.set(key, group);
	}

	// A merged document and an un-merged zh sibling on the same slug cannot be
	// folded together here: mergeProduct wraps an OLD-shape canonical, so feeding
	// it an already-wrapped one would nest arrays inside arrays. Left to the
	// zh-only fixup below it is worse than an error — `canonical` is undefined,
	// so the zh doc gets promoted, rewritten under its own _id and never
	// deleted, leaving two published documents on one slug that
	// `isUniqueAcrossType` then refuses in the Studio. Abort and name them; the
	// operator un-merges the odd one out (or re-exports and starts clean).
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

	// Product id map (zh → canonical) — needed before collections merge and
	// for the global repoint sweep.
	const idMap = new Map();
	for (const group of groups.values()) {
		if (group.zh && group.canonical) idMap.set(group.zh._id, group.canonical._id);
	}

	const products = [...groups.values()].filter((g) => g.canonical?._type === 'pProduct');
	const collections = [...groups.values()].filter((g) => g.canonical?._type === 'pProductCollection');
	const already = [...groups.values()].filter((g) => g.done && !g.canonical).length;
	console.log(
		`groups: ${products.length} products, ${collections.length} collections, ${already} already merged, ${idMap.size} zh docs to fold in`
	);

	// ---- Phase 1: merge canonicals -------------------------------------------
	const mergedDocs = [
		...products.map((g) => mergeProduct(g.canonical, g.zh, idMap)),
		...collections.map((g) => mergeCollection(g.canonical, g.zh, idMap)),
	];
	// Canonicals may themselves reference zh docs (e.g. relatedProducts).
	mergedDocs.forEach((d) => repointRefs(d, idMap));

	// ---- Phase 2: repoint every other inbound reference ----------------------
	// Skipped by _id, not by _type: product documents are only covered by Phase 1
	// if they are in `mergedDocs`, so excluding the whole type would leave an
	// already-merged product pointing at a zh document nothing repoints — and the
	// zh delete below then fails the entire transaction on a strong reference,
	// with an error naming no document. zh docs themselves are skipped because
	// they are deleted, translation.metadata because it is deleted separately.
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
	const metadataIds = zhIds.length
		? await client.fetch(
				`*[_type == "translation.metadata" && references($ids)]._id`,
				{ ids: [...zhIds, ...mergedDocs.map((d) => d._id)] }
			)
		: [];

	console.log(
		`plan: replace ${mergedDocs.length} canonicals, repoint ${repointed.length} referencing docs (${referencing.length} scanned), delete ${zhIds.length} zh docs + ${metadataIds.length} translation.metadata`
	);

	// Everything the zh sibling held that the canonical didn't. Printed always
	// (not just on dry run) because these are the edits an operator would want
	// to eyeball afterwards.
	if (carried.length) {
		console.log(`\ncarried from zh siblings (${carried.length}):`);
		carried.forEach((line) => console.log('  ' + line));
	} else {
		console.log('\ncarried from zh siblings: none');
	}

	if (!EXECUTE) {
		for (const d of mergedDocs.slice(0, 2))
			console.log('\nsample merged doc:', JSON.stringify(d, null, 1).slice(0, 1200));
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
	const [remaining, unwrapped] = await Promise.all([
		client.fetch(`count(*[_type in ["pProduct","pProductCollection"] && defined(language)])`),
		client.fetch(`count(*[_type in ["pProduct","pProductCollection"] && !(_id in path("drafts.**")) && !defined(title[0]._key)])`),
	]);
	console.log(`post-check: docs still carrying language: ${remaining}; docs with unwrapped title: ${unwrapped}`);
	if (remaining > 0 || unwrapped > 0) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
