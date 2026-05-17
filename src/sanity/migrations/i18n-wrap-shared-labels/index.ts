import { at, defineMigration, set } from 'sanity/migrate';
import type { Mutation, NodePatch } from 'sanity/migrate';

/*
	Wraps plain string `label` / `title` fields on shared i18n-enabled objects into
	the internationalizedArrayString format expected by sanity-plugin-internationalized-array.

	Targets:
	  - link.label       (_type == "link"        → wrap label as [{_key:'en', value: <string>}])
	  - callToAction.label (_type == "callToAction" → wrap label)
	  - navItem.title    (_type == "navItem"     → wrap title)

	Run order:
	  1. Deploy schema changes (objects/link.ts, objects/call-to-action.js, objects/nav-item.ts).
	  2. npx sanity migration run i18n-wrap-shared-labels --no-dry-run
	  3. Optionally validate: npx sanity documents validate
*/

const TARGETS: Record<string, string[]> = {
	link: ['label'],
	callToAction: ['label'],
	navItem: ['title'],
};

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

function wrap(value: string): { _key: string; value: string }[] {
	return [{ _key: 'en', value }];
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
	if (type && TARGETS[type]) {
		for (const fieldName of TARGETS[type]) {
			const fieldValue = node[fieldName];
			if (typeof fieldValue === 'string' && fieldValue.length > 0) {
				patches.push(at(`${currentPath}.${fieldName}`, set(wrap(fieldValue))));
			} else if (fieldValue && !isAlreadyWrapped(fieldValue)) {
				// skip — unknown shape
			}
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
	if (type && TARGETS[type]) {
		for (const fieldName of TARGETS[type]) {
			if (typeof node[fieldName] === 'string') return true;
		}
	}
	return Object.values(node).some(needsMigration);
}

export default defineMigration({
	title: 'Wrap shared label/title fields into internationalizedArrayString',
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
