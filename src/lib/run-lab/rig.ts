/**
 * The contract between Run Lab's code and `public/models/runner-v1.glb`.
 *
 * Bone names follow Mixamo's convention as three.js sees them: GLTFLoader runs
 * PropertyBinding.sanitizeNodeName, which strips the colon, so the exported
 * `mixamorig:Hips` arrives as `mixamorigHips`. A Mixamo-named rig (Quaternius,
 * Mixamo itself) therefore needs no code change beyond this file -- but see
 * `docs/RUN-LAB-MODEL.md` on bone AXES, which a map cannot fix.
 */

export const RUNNER_MODEL_URL = '/models/runner-v1.glb';

export const MIXAMO_BONES = {
	hips: 'mixamorigHips',
	spine: 'mixamorigSpine',
	spine1: 'mixamorigSpine1',
	spine2: 'mixamorigSpine2',
	neck: 'mixamorigNeck',
	head: 'mixamorigHead',
	leftShoulder: 'mixamorigLeftShoulder',
	leftArm: 'mixamorigLeftArm',
	leftForeArm: 'mixamorigLeftForeArm',
	leftHand: 'mixamorigLeftHand',
	rightShoulder: 'mixamorigRightShoulder',
	rightArm: 'mixamorigRightArm',
	rightForeArm: 'mixamorigRightForeArm',
	rightHand: 'mixamorigRightHand',
	leftUpLeg: 'mixamorigLeftUpLeg',
	leftLeg: 'mixamorigLeftLeg',
	leftFoot: 'mixamorigLeftFoot',
	leftToeBase: 'mixamorigLeftToeBase',
	rightUpLeg: 'mixamorigRightUpLeg',
	rightLeg: 'mixamorigRightLeg',
	rightFoot: 'mixamorigRightFoot',
	rightToeBase: 'mixamorigRightToeBase',
} as const;

export type BoneKey = keyof typeof MIXAMO_BONES;

export const CLIP_NAMES = ['jog', 'run', 'sprint'] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

/** Blender exports clips as `Armature|jog`; keep only the part after the bar. */
export function normaliseClipName(name: string): string {
	return name.split('|').pop() ?? name;
}

/** The glTF node name three.js will expose, per GLTFLoader's sanitisation. */
export function sanitiseNodeName(name: string): string {
	return name.replace(/\s/g, '_').replace(/[[\].:/]/g, '');
}

type Named = { name: string; children: readonly Named[] };

/**
 * Look every mapped bone up by name. A missing bone is reported, not thrown:
 * the runner then simply ignores that override.
 */
export function resolveBones<T extends Named>(
	root: T,
	map: Record<BoneKey, string> = MIXAMO_BONES
): { bones: Partial<Record<BoneKey, T>>; missing: BoneKey[] } {
	const byName = new Map<string, T>();
	const walk = (node: T) => {
		byName.set(node.name, node);
		for (const child of node.children) walk(child as T);
	};
	walk(root);
	const bones: Partial<Record<BoneKey, T>> = {};
	const missing: BoneKey[] = [];
	for (const key of Object.keys(map) as BoneKey[]) {
		const bone = byName.get(map[key]);
		if (bone) bones[key] = bone;
		else missing.push(key);
	}
	return { bones, missing };
}
