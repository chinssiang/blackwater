import { chestScaleFor } from '@/lib/run-lab/breath';
import type { Overrides } from '@/lib/run-lab/dials';
import { type Stances, detectStance, intervalLength } from '@/lib/run-lab/gait';
import {
	CLOTH_HEM_BONE,
	decalFor,
	isKitNode,
	isNodeVisible,
} from '@/lib/run-lab/kit';
import { DEG, mod } from '@/lib/run-lab/math';
import type { ClipWeights } from '@/lib/run-lab/pace';
import {
	type BoneKey,
	CLIP_NAMES,
	type ClipName,
	normaliseClipName,
	resolveBones,
} from '@/lib/run-lab/rig';
import type { TopId } from '@/lib/run-lab/types';
import { decalTexture } from './decals';
import {
	type AnimationAction,
	AnimationMixer,
	type Bone,
	DoubleSide,
	Euler,
	type Material,
	type Mesh,
	MeshStandardMaterial,
	type Object3D,
	Quaternion,
	type SkinnedMesh,
	Vector3,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type Rig = {
	root: Object3D;
	mixer: AnimationMixer;
	actions: Partial<Record<ClipName, AnimationAction>>;
	bones: Partial<Record<BoneKey, Bone>>;
	rest: Map<
		Bone,
		{ quaternion: Quaternion; position: Vector3; scale: Vector3 }
	>;
	/** The last pose the CLIPS produced, before any override (see poseClips). */
	posed: Map<Bone, { quaternion: Quaternion; position: Vector3 }>;
	/** The body's own materials (the Pacer fades these). */
	materials: Material[];
	/** Every named mesh, for showing the kit that is on. */
	parts: { name: string; object: Object3D }[];
	/** The top `wearTop` last applied, so it only walks the parts on a change. */
	wornTop: TopId | null;
	cloth: { bone: Bone | null; pos: Vector3; vel: Vector3; primed: boolean };
};

/**
 * One skinned copy of the model with its own mixer. SkeletonUtils.clone, not
 * `scene.clone()`, so each copy gets its own skeleton; and both the runner and
 * the Pacer are clones, so neither mutates the loader's cached scene. The
 * Pacer is built with `kit: false`: it is the form, not the outfit.
 */
export function createRig(
	gltf: GLTF,
	material: () => Material,
	{ kit }: { kit: boolean }
): Rig {
	const root = cloneSkinned(gltf.scene);
	const materials: Material[] = [];
	const parts: Rig['parts'] = [];
	root.traverse((node) => {
		const mesh = node as Mesh;
		if (!mesh.isMesh) return;
		// Skinned bounds are the bind pose's; a raised knee can leave them.
		mesh.frustumCulled = false;
		if (isKitNode(mesh.name)) {
			if (!kit) {
				mesh.visible = false;
				return;
			}
			mesh.material = kitMaterial(mesh.material as MeshStandardMaterial);
			parts.push({ name: mesh.name, object: mesh });
			return;
		}
		const m = material();
		mesh.material = m;
		materials.push(m);
		if (kit) parts.push({ name: mesh.name, object: mesh });
	});

	// SkeletonUtils.clone gives every mesh its own copy of the one skeleton,
	// and three updates each copy every frame (bone matrices plus a texture
	// upload per mesh). They all bind the same armature with the same inverse
	// binds, so point them at one.
	const skinned: SkinnedMesh[] = [];
	root.traverse((node) => {
		if ((node as SkinnedMesh).isSkinnedMesh) skinned.push(node as SkinnedMesh);
	});
	const shared = skinned[0]?.skeleton;
	for (const mesh of skinned)
		if (shared && mesh.skeleton !== shared) mesh.bind(shared, mesh.bindMatrix);

	const { bones, missing } = resolveBones(root as unknown as Bone);
	if (missing.length)
		console.warn('[run-lab] model is missing bones:', missing.join(', '));

	const mixer = new AnimationMixer(root);
	const actions: Rig['actions'] = {};
	for (const clip of gltf.animations) {
		const name = normaliseClipName(clip.name) as ClipName;
		if (!CLIP_NAMES.includes(name)) continue;
		const action = mixer.clipAction(clip);
		action.play();
		// The master phase drives the playhead (see World); the mixer never
		// advances time itself, it only samples at `action.time`.
		action.paused = true;
		action.setEffectiveWeight(0);
		actions[name] = action;
	}

	const clothBone =
		(root.getObjectByName(CLOTH_HEM_BONE) as Bone | undefined) ?? null;
	const rest: Rig['rest'] = new Map();
	for (const bone of [...Object.values(bones), clothBone]) {
		if (!bone) continue;
		rest.set(bone, {
			quaternion: bone.quaternion.clone(),
			position: bone.position.clone(),
			scale: bone.scale.clone(),
		});
	}
	const posed: Rig['posed'] = new Map();
	for (const [bone, r] of rest) {
		posed.set(bone, {
			quaternion: r.quaternion.clone(),
			position: r.position.clone(),
		});
	}
	return {
		root,
		mixer,
		actions,
		bones,
		rest,
		posed,
		materials,
		parts,
		wornTop: null,
		cloth: {
			bone: clothBone,
			pos: new Vector3(),
			vel: new Vector3(),
			primed: false,
		},
	};
}

/**
 * Fabric keeps the colour the model was authored with; decals get their
 * painted print. Double-sided, so an open hem or neckline shows its inside.
 */
function kitMaterial(source: MeshStandardMaterial): Material {
	const decal = decalFor(source.name);
	if (decal) {
		return new MeshStandardMaterial({
			map: decalTexture(decal),
			transparent: true,
			alphaTest: 0.05,
			depthWrite: false,
			roughness: 0.85,
			// Sits a hair off the fabric: win the depth test where they meet.
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -4,
		});
	}
	return new MeshStandardMaterial({
		color: source.color,
		roughness: source.roughness,
		metalness: 0,
		side: DoubleSide,
	});
}

/** Show the top that is on, and hide the body it covers. */
export function wearTop(rig: Rig, top: TopId) {
	if (rig.wornTop === top) return;
	rig.wornTop = top;
	for (const { name, object } of rig.parts) {
		const visible = isNodeVisible(name, top);
		if (object.visible !== visible) object.visible = visible;
	}
}

// The hem's spring: about 2Hz and underdamped, slower than a stride, so the
// hem lags each bounce and swings back instead of riding rigidly on the chest.
const CLOTH_STIFFNESS = 150;
const CLOTH_DAMPING = 10;
const CLOTH_MAX_OFFSET = 0.05;
const CLOTH_SUBSTEP = 1 / 120;
const clothTarget = new Vector3();
const clothForce = new Vector3();

/**
 * Advance the hem bone one frame. `drag` is the air the runner moves through,
 * in world space, and pushes the hem back further the faster the pace. Held
 * (scrubbing, reduced motion) the hem rests where it hangs.
 */
export function stepCloth(rig: Rig, dt: number, drag: Vector3, hold: boolean) {
	const { bone, pos, vel } = rig.cloth;
	const parent = bone?.parent;
	const rest = bone ? rig.rest.get(bone) : undefined;
	if (!bone || !parent || !rest) return;
	parent.updateWorldMatrix(true, false);
	clothTarget.copy(rest.position).applyMatrix4(parent.matrixWorld).add(drag);
	if (hold || !rig.cloth.primed) {
		pos.copy(clothTarget);
		vel.set(0, 0, 0);
		rig.cloth.primed = true;
	} else {
		for (let t = 0; t < dt; t += CLOTH_SUBSTEP) {
			const h = Math.min(CLOTH_SUBSTEP, dt - t);
			clothForce
				.subVectors(clothTarget, pos)
				.multiplyScalar(CLOTH_STIFFNESS)
				.addScaledVector(vel, -CLOTH_DAMPING);
			vel.addScaledVector(clothForce, h);
			pos.addScaledVector(vel, h);
		}
		clothForce.subVectors(pos, clothTarget);
		if (clothForce.length() > CLOTH_MAX_OFFSET) {
			clothForce.setLength(CLOTH_MAX_OFFSET);
			pos.addVectors(clothTarget, clothForce);
		}
	}
	bone.position.copy(parent.worldToLocal(clothTarget.copy(pos)));
}

/** What the sampling pass learns about each clip. */
export type ClipTiming = {
	/** Clip phase at which the left foot lands; added to the master phase. */
	offset: number;
	/** Stance windows in MASTER phase (left footfall at 0). */
	stances: Stances;
	/** Metres the stance foot travels backwards, and the stance's share of a cycle. */
	travel: number;
	stanceShare: number;
};

const SAMPLES = 120;

/**
 * Sample each clip once at load: foot heights give the stance windows (and so
 * footfalls), foot depth over the stance gives how far the ground must move
 * per step for the foot not to skate. Nothing about the gait is hand-entered,
 * so a different model with different clips still lines up.
 */
export function measureClips(rig: Rig): Partial<Record<ClipName, ClipTiming>> {
	const out: Partial<Record<ClipName, ClipTiming>> = {};
	const { leftFoot, rightFoot } = rig.bones;
	if (!leftFoot || !rightFoot) return out;
	const world = new Vector3();

	for (const name of CLIP_NAMES) {
		const action = rig.actions[name];
		if (!action) continue;
		for (const other of Object.values(rig.actions))
			other?.setEffectiveWeight(other === action ? 1 : 0);

		const duration = action.getClip().duration;
		const left = new Float32Array(SAMPLES);
		const right = new Float32Array(SAMPLES);
		const leftZ = new Float32Array(SAMPLES);
		for (let i = 0; i < SAMPLES; i++) {
			action.time = (i / SAMPLES) * duration;
			rig.mixer.update(0);
			rig.root.updateMatrixWorld(true);
			leftFoot.getWorldPosition(world);
			left[i] = world.y;
			leftZ[i] = world.z;
			rightFoot.getWorldPosition(world);
			right[i] = world.y;
		}

		const leftStance = detectStance(left);
		const rightStance = detectStance(right);
		// Where the clip's playhead must start so master phase 0 is the left
		// footfall: aligning every clip this way keeps one rhythm across
		// jog/run/sprint crossfades.
		const offset = mod(leftStance[0]);
		const toMaster = ([s, e]: readonly [number, number]) =>
			[mod(s - offset), mod(e - offset)] as const;
		const at = (p: number) => leftZ[Math.round(p * SAMPLES) % SAMPLES];

		out[name] = {
			offset,
			stances: { left: toMaster(leftStance), right: toMaster(rightStance) },
			travel: Math.max(0, at(leftStance[0]) - at(leftStance[1])),
			stanceShare: intervalLength(leftStance),
		};
	}
	for (const action of Object.values(rig.actions))
		action?.setEffectiveWeight(0);
	snapshotPose(rig);
	return out;
}

function snapshotPose(rig: Rig) {
	for (const [bone, p] of rig.posed) {
		p.quaternion.copy(bone.quaternion);
		p.position.copy(bone.position);
	}
}

/** Pose every clip at the master phase, blended by weight. */
export function poseClips(
	rig: Rig,
	phase: number,
	weights: ClipWeights,
	timing: Partial<Record<ClipName, ClipTiming>>
) {
	// Put every bone back to the last CLIP pose before sampling, so the
	// additive overrides applied after this never accumulate. Not back to the
	// rest pose: three's PropertyMixer writes a bone only when its value has
	// changed since its last write, so a held stride (scrubbing, reduced
	// motion, paused) samples the same values, writes nothing, and a reset to
	// rest would stand the runner in its bind pose on the next repaint.
	for (const [bone, r] of rig.rest) {
		// `posed` is seeded from `rest` at creation, so every bone has an entry.
		const p = rig.posed.get(bone)!;
		bone.quaternion.copy(p.quaternion);
		bone.position.copy(p.position);
		bone.scale.copy(r.scale);
	}
	for (const name of CLIP_NAMES) {
		const action = rig.actions[name];
		if (!action) continue;
		action.setEffectiveWeight(weights[name]);
		const offset = timing[name]?.offset ?? 0;
		action.time = ((phase + offset) % 1) * action.getClip().duration;
	}
	rig.mixer.update(0);
	snapshotPose(rig);
}

const euler = new Euler();
const quat = new Quaternion();

/** Rotate a bone in its own (already posed) frame. */
function turn(bone: Bone | undefined, x: number, y = 0, z = 0) {
	if (!bone || (x === 0 && y === 0 && z === 0)) return;
	quat.setFromEuler(euler.set(x, y, z, 'XYZ'));
	bone.quaternion.multiply(quat);
}

/** A bone's current flexion about its X axis, for joints that only hinge. */
function hingeAngle(bone: Bone | undefined): number {
	if (!bone) return 0;
	return 2 * Math.atan2(bone.quaternion.x, bone.quaternion.w);
}

/**
 * Apply the dial overrides on top of the clip pose. Axis conventions are the
 * stand-in rig's (identity rest rotations; see scripts/build-runner-model.mjs):
 * local X pitches, and for a limb hanging down a positive X swings it back.
 */
export function applyOverrides(rig: Rig, o: Overrides, breathLevel: number) {
	const b = rig.bones;
	// The lean from the ankles pivots the whole body about the feet, which sit
	// at the root's origin.
	rig.root.rotation.x = o.bodyPitch;

	turn(b.spine, o.spineFold * 0.5);
	turn(b.spine1, o.spineFold * 0.5);
	turn(b.spine2, o.upperBackRound);
	// The neck partly undoes the upper-back rounding, as a real one does.
	turn(b.neck, o.neckPitch - o.upperBackRound * 0.6);
	turn(b.head, o.headPitch);

	turn(b.leftShoulder, 0, -o.shoulderForward, o.shoulderLift);
	turn(b.rightShoulder, 0, o.shoulderForward, -o.shoulderLift);

	// Internal rotation of the upper arm swings the bent forearm across the
	// body; a little adduction brings the elbow in with it.
	turn(b.leftArm, 0, -o.armCross, -o.armCross * 0.2);
	turn(b.rightArm, 0, o.armCross, o.armCross * 0.2);
	turn(b.leftForeArm, o.elbowUnbend);
	turn(b.rightForeArm, o.elbowUnbend);

	for (const side of ['left', 'right'] as const) {
		const upLeg = side === 'left' ? b.leftUpLeg : b.rightUpLeg;
		const leg = side === 'left' ? b.leftLeg : b.rightLeg;
		const foot = side === 'left' ? b.leftFoot : b.rightFoot;
		const reach = o.reach[side];
		if (reach > 0) {
			turn(upLeg, -18 * DEG * reach);
			// Straighten the knee toward, never past, straight.
			turn(
				leg,
				-Math.min(28 * DEG * reach, Math.max(0, hingeAngle(leg) - 3 * DEG))
			);
			turn(foot, -20 * DEG * reach);
		}
		const toes = o.toeStance[side];
		if (toes > 0) turn(foot, 26 * DEG * toes);
	}

	if (b.hips) {
		const toes = Math.max(o.toeStance.left, o.toeStance.right);
		b.hips.position.y += o.hipsY + 0.045 * toes;
	}

	if (b.spine2) {
		const [x, y, z] = chestScaleFor(breathLevel);
		b.spine2.scale.set(x, y, z);
		// Counter-scale the chest's children so the arms and head keep their size.
		for (const child of [b.neck, b.leftShoulder, b.rightShoulder])
			child?.scale.set(1 / x, 1 / y, 1 / z);
	}
}
