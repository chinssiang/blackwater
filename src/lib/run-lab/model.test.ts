import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import {
	BODY_NODES,
	BOTTOM_NODES,
	CLOTH_HEM_BONE,
	HAIR_NODE,
	SHOE_NODES,
	topNode,
} from './kit';
import {
	CLIP_NAMES,
	MIXAMO_BONES,
	RUNNER_MODEL_URL,
	normaliseClipName,
	sanitiseNodeName,
} from './rig';
import { TOP_IDS } from './types';
import { statSync } from 'node:fs';

// The asset contract: a re-export that renames a bone or a clip, or turns on a
// compression the CSP cannot decode (Draco, meshopt: WASM + blob workers),
// fails here rather than as a silently frozen runner in the browser.
const FILE = `public${RUNNER_MODEL_URL}`;
const ALLOWED_REQUIRED = new Set(['KHR_mesh_quantization']);

describe('runner model', async () => {
	const doc = await new NodeIO().read(FILE);
	const root = doc.getRoot();
	const nodeNames = new Set(
		root.listNodes().map((n) => sanitiseNodeName(n.getName()))
	);
	const clipNames = root
		.listAnimations()
		.map((a) => normaliseClipName(a.getName()));

	it('carries every mapped bone', () => {
		const missing = Object.values(MIXAMO_BONES).filter(
			(name) => !nodeNames.has(name)
		);
		expect(missing).toEqual([]);
	});

	it('carries every body region, garment, the hair and the cloth bone', () => {
		const expected = [
			...BODY_NODES,
			...TOP_IDS.map(topNode),
			...BOTTOM_NODES,
			...SHOE_NODES,
			HAIR_NODE,
			CLOTH_HEM_BONE,
		];
		expect(expected.filter((name) => !nodeNames.has(name))).toEqual([]);
	});

	it('carries every clip', () => {
		for (const clip of CLIP_NAMES) expect(clipNames).toContain(clip);
	});

	it('needs no decoder', () => {
		const required = root.listExtensionsRequired().map((e) => e.extensionName);
		expect(required.filter((e) => !ALLOWED_REQUIRED.has(e))).toEqual([]);
	});

	it('stays small', () => {
		expect(statSync(FILE).size).toBeLessThan(800 * 1024);
	});
});
