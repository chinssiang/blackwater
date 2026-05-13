import { at, defineMigration, set, unset } from 'sanity/migrate';
import type { Mutation, NodePatch } from 'sanity/migrate';

/*
	Flattens nested `linkInput` objects into the parent `link` (or `destination`)
	by lifting `linkType` / `internalLink` up one level and renaming `externalUrl`
	to `href`, then unsetting the now-empty `linkInput` wrapper.

	Run order:
	  1. Deploy this schema change (link.js is flat; link-input.js is gone).
	  2. npx sanity migration run flatten-link-input --no-dry-run
	  3. Optionally validate: npx sanity documents validate
*/

type LinkInputShape = {
	linkType?: unknown;
	internalLink?: unknown;
	externalUrl?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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

	const linkInput = node.linkInput;
	if (isRecord(linkInput)) {
		const li = linkInput as LinkInputShape;
		if (li.linkType !== undefined) {
			patches.push(at(`${currentPath}.linkType`, set(li.linkType)));
		}
		if (li.internalLink !== undefined) {
			patches.push(at(`${currentPath}.internalLink`, set(li.internalLink)));
		}
		if (li.externalUrl !== undefined) {
			patches.push(at(`${currentPath}.href`, set(li.externalUrl)));
		}
		patches.push(at(`${currentPath}.linkInput`, unset()));
	}

	for (const [k, v] of Object.entries(node)) {
		if (k.startsWith('_')) continue;
		const childPath = currentPath ? `${currentPath}.${k}` : k;
		walk(v, childPath, patches);
	}
}

function containsLinkInput(node: unknown): boolean {
	if (Array.isArray(node)) return node.some(containsLinkInput);
	if (!isRecord(node)) return false;
	if (isRecord(node.linkInput)) return true;
	return Object.values(node).some(containsLinkInput);
}

export default defineMigration({
	title: 'Flatten linkInput into parent link object',
	migrate: {
		document(doc): Mutation[] | NodePatch[] | undefined {
			if (!containsLinkInput(doc)) return;
			const patches: NodePatch[] = [];
			for (const [k, v] of Object.entries(doc)) {
				if (k.startsWith('_')) continue;
				walk(v, k, patches);
			}
			return patches;
		},
	},
});
