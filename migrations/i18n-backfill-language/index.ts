import { at, defineMigration, set } from 'sanity/migrate';
import type { Mutation, NodePatch } from 'sanity/migrate';

/*
	Backfills the `language` field on all internationalizedArrayString items that only
	have `_key` (created by earlier i18n-wrap-* migrations that didn't set `language`).

	Identification: an array item with `_key` + `value` + no `language`, where all
	keys are in the set {_key, _type, value, language}. This matches i18n array items
	and avoids touching unrelated array objects.

	Safe to re-run — idempotent (skips items that already have `language`).

	Run once:
	  npx sanity migration run i18n-backfill-language --no-dry-run
*/

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const I18N_KEYS = new Set(['_key', '_type', 'value', 'language']);

function isI18nItem(item: unknown): item is Record<string, unknown> {
	return (
		isRecord(item) &&
		typeof item._key === 'string' &&
		typeof item.value === 'string' &&
		typeof item.language !== 'string' &&
		Object.keys(item).every((k) => I18N_KEYS.has(k))
	);
}

function walk(node: unknown, path: string, patches: NodePatch[]): void {
	if (Array.isArray(node)) {
		node.forEach((item, i) => {
			const key = isRecord(item) && typeof item._key === 'string' ? item._key : undefined;
			const itemPath = key ? `${path}[_key=="${key}"]` : `${path}[${i}]`;
			if (isI18nItem(item)) {
				patches.push(at(`${itemPath}.language`, set(item._key as string)));
			}
			walk(item, itemPath, patches);
		});
		return;
	}
	if (!isRecord(node)) return;
	for (const [k, v] of Object.entries(node)) {
		if (k.startsWith('_')) continue;
		walk(v, path ? `${path}.${k}` : k, patches);
	}
}

export default defineMigration({
	title: 'Backfill language field on internationalizedArrayString items',
	migrate: {
		document(doc): Mutation[] | NodePatch[] | undefined {
			const patches: NodePatch[] = [];
			for (const [k, v] of Object.entries(doc)) {
				if (k.startsWith('_')) continue;
				walk(v, k, patches);
			}
			return patches.length ? patches : undefined;
		},
	},
});
