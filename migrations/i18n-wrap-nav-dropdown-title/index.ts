import { at, defineMigration, set } from 'sanity/migrate';
import type { Mutation, NodePatch } from 'sanity/migrate';

/*
	Wraps plain string `title` fields on navDropdown objects into
	the internationalizedArrayString format expected by sanity-plugin-internationalized-array.

	Run after deploying the schema change to nav-dropdown.js:
	  npx sanity migration run i18n-wrap-nav-dropdown-title --no-dry-run
*/

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAlreadyWrapped(value: unknown): boolean {
	if (!Array.isArray(value)) return false;
	return value.every(
		(entry) =>
			isRecord(entry) &&
			typeof entry._key === 'string' &&
			typeof (entry as Record<string, unknown>).value !== 'undefined'
	);
}

function wrap(value: string): { _key: string; language: string; value: string }[] {
	return [{ _key: 'en', language: 'en', value }];
}

function walk(node: unknown, currentPath: string, patches: NodePatch[]): void {
	if (Array.isArray(node)) {
		node.forEach((item, i) => {
			const key =
				isRecord(item) && typeof item._key === 'string' ? item._key : undefined;
			const itemPath = key
				? `${currentPath}[_key=="${key}"]`
				: `${currentPath}[${i}]`;
			walk(item, itemPath, patches);
		});
		return;
	}

	if (!isRecord(node)) return;

	const type = typeof node._type === 'string' ? node._type : undefined;
	if (type === 'navDropdown') {
		const fieldValue = node['title'];
		if (typeof fieldValue === 'string' && fieldValue.length > 0) {
			patches.push(at(`${currentPath}.title`, set(wrap(fieldValue))));
		}
	}

	for (const [k, v] of Object.entries(node)) {
		if (k.startsWith('_')) continue;
		const childPath = currentPath ? `${currentPath}.${k}` : k;
		walk(v, childPath, patches);
	}
}

function needsMigration(node: unknown): boolean {
	if (Array.isArray(node)) return node.some(needsMigration);
	if (!isRecord(node)) return false;
	const type = typeof node._type === 'string' ? node._type : undefined;
	if (type === 'navDropdown' && typeof node['title'] === 'string') return true;
	return Object.values(node).some(needsMigration);
}

export default defineMigration({
	title: 'Wrap navDropdown.title into internationalizedArrayString',
	migrate: {
		document(doc): Mutation[] | NodePatch[] | undefined {
			if (!needsMigration(doc)) return;
			const patches: NodePatch[] = [];
			for (const [k, v] of Object.entries(doc)) {
				if (k.startsWith('_')) continue;
				walk(v, k, patches);
			}
			return patches;
		},
	},
});
