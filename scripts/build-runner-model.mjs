/**
 * Builds `public/models/runner-v1.glb`, Run Lab's runner: a clay figure with a
 * sculpted face and short hair on a Mixamo-named skeleton, wearing the club's
 * kit, with three procedurally built run cycles (`jog`, `run`, `sprint`). Everything here is
 * original geometry, so the asset is ours to ship; `docs/RUN-LAB-MODEL.md`
 * explains how to replace it with a Quaternius export instead.
 *
 *   node scripts/build-runner-model.mjs
 *
 * Conventions the runtime relies on (src/lib/run-lab/rig.ts, scene/runner-rig):
 * - The runner faces +Z, its left is +X, Y is up, units are metres.
 * - Every bone's REST rotation is identity, so a bone's local X is a pitch
 *   (spine: positive tips forward; limbs pointing down: positive swings back),
 *   local Y a twist and local Z a roll.
 * - Every clip is one full stride, left foot striking at t = 0, and runs in
 *   place: the hips bob and sway, but never travel forward.
 * - The body is split into regions (`Body_*`) so the runtime can hide what a
 *   garment covers. That is what keeps skin from poking through fabric: the
 *   covered body is not drawn, rather than drawn and hoped to stay inside.
 * - Garments are SKINNED with blended weights across the joints they span
 *   (spine, shoulder, hip, forefoot), so they stretch and fold with the body
 *   instead of splitting at the joint the way the rigid mannequin parts do.
 *   Loose tops also weight their hem to `ClothHem`, a bone no clip animates:
 *   the runtime drives it with a spring, which is the fabric's inertia.
 */
import { Document, NodeIO, PropertyType } from '@gltf-transform/core';
import { dedup, prune } from '@gltf-transform/functions';
import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';

const OUT = new URL('../public/models/runner-v1.glb', import.meta.url);
const DEG = Math.PI / 180;
const PREFIX = 'mixamorig:';
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smoothstep = (a, b, v) => {
	const t = clamp01((v - a) / (b - a));
	return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- skeleton --

const LEFT = [
	['LeftShoulder', 'Spine2', [0.03, 1.43, 0]],
	['LeftArm', 'LeftShoulder', [0.18, 1.42, 0]],
	['LeftForeArm', 'LeftArm', [0.19, 1.14, 0]],
	['LeftHand', 'LeftForeArm', [0.19, 0.91, 0]],
	['LeftUpLeg', 'Hips', [0.095, 0.92, 0]],
	['LeftLeg', 'LeftUpLeg', [0.095, 0.51, 0]],
	['LeftFoot', 'LeftLeg', [0.095, 0.09, -0.02]],
	['LeftToeBase', 'LeftFoot', [0.095, 0.02, 0.11]],
];
const mirror = ([name, parent, [x, y, z]]) => [
	name.replace('Left', 'Right'),
	parent.replace('Left', 'Right'),
	[-x, y, z],
];
const BONES = [
	['Hips', null, [0, 0.96, 0]],
	['Spine', 'Hips', [0, 1.04, 0]],
	['Spine1', 'Spine', [0, 1.16, 0]],
	['Spine2', 'Spine1', [0, 1.28, 0]],
	['Neck', 'Spine2', [0, 1.48, 0]],
	['Head', 'Neck', [0, 1.56, 0.01]],
	...LEFT,
	...LEFT.map(mirror),
	// No clip animates this one: scene/runner-rig drives it with a spring.
	['ClothHem', 'Spine', [0, 1.0, 0]],
];
const HEAD = Object.fromEntries(BONES.map(([n, , h]) => [n, h]));
// Bones the Mixamo prefix applies to (ClothHem is ours, not Mixamo's).
const boneNodeName = (name) => (name === 'ClothHem' ? name : PREFIX + name);

// ------------------------------------------------------------- materials --

// Colours read off the product photographs; sRGB hex, converted to glTF's
// linear factors by THREE.Color.
const MATERIALS = {
	Clubmate: { color: '#a3a3a1', roughness: 0.62 },
	Hair: { color: '#2b2a28', roughness: 0.95 },
	Fabric_component: { color: '#1d1d1d', roughness: 0.9 },
	Fabric_coda: { color: '#1b1b1b', roughness: 0.85 },
	Fabric_hoole: { color: '#403f3d', roughness: 1 },
	Fabric_communion: { color: '#303134', roughness: 0.9 },
	Fabric_tight: { color: '#232324', roughness: 0.7 },
	Fabric_tight_pocket: { color: '#1b1b1c', roughness: 0.75 },
	Shoe_upper: { color: '#cfcfcd', roughness: 0.9 },
	Shoe_midsole: { color: '#dad9d4', roughness: 0.7 },
	Shoe_outsole: { color: '#1c1c1c', roughness: 0.9 },
	Shoe_lace: { color: '#e4e4e2', roughness: 0.9 },
	// Decals are painted at runtime (text, marks); the GLB carries white.
	Decal_blkwtr: { color: '#ffffff', roughness: 0.8 },
	Decal_nb: { color: '#ffffff', roughness: 0.8 },
	Decal_hoole: { color: '#ffffff', roughness: 0.9 },
	Decal_n: { color: '#ffffff', roughness: 0.8 },
};

// ------------------------------------------------------------------ nodes --

/** node name -> { material, pieces: [{ geometry, weigh }] } */
const NODES = new Map();
function add(node, material, geometry, weigh) {
	if (!MATERIALS[material]) throw new Error(`unknown material ${material}`);
	if (!NODES.has(node)) NODES.set(node, { material, pieces: [] });
	const entry = NODES.get(node);
	if (entry.material !== material) throw new Error(`${node} mixes materials`);
	entry.pieces.push({ geometry, weigh });
}
const rigid = (bone) => () => [[bone, 1]];

// ------------------------------------------------------------ geometry --

/** A superellipse point: n = 2 is an ellipse, higher is squarer. */
function superCS(t, n = 2) {
	const s = Math.sin(t);
	const c = Math.cos(t);
	const e = 2 / n;
	return [Math.sign(s) * Math.abs(s) ** e, Math.sign(c) * Math.abs(c) ** e];
}
const v3 = (a) => new THREE.Vector3(...a);

/**
 * Loft a closed skin through a path of rings: the one primitive the body, the
 * clothes and the shoes are all made of. Each ring is
 *   { p: [x,y,z] centre, a: radius across `u`, b: radius toward `front`, n? }
 * where `front` is the world direction the `b` radius points (the runner's
 * front for limbs and torso, up for a foot). Ring-major vertices, so a loft can
 * be cut into regions by ring index. Normals are smooth and oriented outward.
 */
function loft(
	rings,
	{ radial = 16, front = [0, 0, 1], capStart = false, capEnd = false } = {}
) {
	const F = v3(front);
	const pos = [];
	const centres = rings.map((r) => v3(r.p));
	rings.forEach((r, i) => {
		const prev = centres[Math.max(0, i - 1)];
		const next = centres[Math.min(rings.length - 1, i + 1)];
		const T = next.clone().sub(prev).normalize();
		const V = F.clone()
			.sub(T.clone().multiplyScalar(F.dot(T)))
			.normalize();
		const U = V.clone().cross(T).normalize();
		for (let j = 0; j < radial; j++) {
			const [s, c] = superCS((j / radial) * Math.PI * 2, r.n);
			const p = centres[i]
				.clone()
				.addScaledVector(U, r.a * s)
				.addScaledVector(V, r.b * c);
			if (r.dy) p.y += r.dy(Math.atan2(s, c));
			pos.push(p.x, p.y, p.z);
		}
	});
	const idx = [];
	for (let i = 0; i < rings.length - 1; i++) {
		for (let j = 0; j < radial; j++) {
			const a = i * radial + j;
			const b = i * radial + ((j + 1) % radial);
			idx.push(a, a + radial, b, b, a + radial, b + radial);
		}
	}
	const cap = (ring, centre, flip) => {
		const k = pos.length / 3;
		pos.push(centre.x, centre.y, centre.z);
		for (let j = 0; j < radial; j++) {
			const a = ring * radial + j;
			const b = ring * radial + ((j + 1) % radial);
			idx.push(...(flip ? [k, b, a] : [k, a, b]));
		}
	};
	if (capStart) {
		const T = centres[0].clone().sub(centres[1]).normalize();
		cap(
			0,
			centres[0]
				.clone()
				.addScaledVector(T, Math.min(rings[0].a, rings[0].b) * 0.5),
			false
		);
	}
	if (capEnd) {
		const n = rings.length - 1;
		const T = centres[n]
			.clone()
			.sub(centres[n - 1])
			.normalize();
		cap(
			n,
			centres[n]
				.clone()
				.addScaledVector(T, Math.min(rings[n].a, rings[n].b) * 0.5),
			true
		);
	}
	let g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setIndex(idx);
	g.computeVertexNormals();
	// Orient outward: the first ring's first normal should point away from
	// its centre. The path's direction decides the winding, so check.
	const n0 = new THREE.Vector3().fromBufferAttribute(
		g.attributes.normal,
		radial
	);
	const p0 = new THREE.Vector3().fromBufferAttribute(
		g.attributes.position,
		radial
	);
	if (n0.dot(p0.sub(centres[Math.min(1, rings.length - 1)])) < 0) {
		const flipped = [];
		for (let i = 0; i < idx.length; i += 3)
			flipped.push(idx[i], idx[i + 2], idx[i + 1]);
		g.setIndex(flipped);
		g.computeVertexNormals();
	}
	g.userData = { radial, rings: rings.length };
	return g;
}

/**
 * Cut a loft into a band of rings [from, to], keeping the full loft's normals
 * so neighbouring regions meet without a shading seam. Caps belong to the
 * band that holds their ring.
 */
function band(g, from, to) {
	const { radial, rings } = g.userData;
	const p = g.attributes.position;
	const nr = g.attributes.normal;
	const keep = new Map();
	const pos = [];
	const nor = [];
	const take = (i) => {
		if (!keep.has(i)) {
			keep.set(i, pos.length / 3);
			pos.push(p.getX(i), p.getY(i), p.getZ(i));
			nor.push(nr.getX(i), nr.getY(i), nr.getZ(i));
		}
		return keep.get(i);
	};
	const ringOf = (i) => (i < rings * radial ? Math.floor(i / radial) : null);
	const idx = [];
	const src = g.index.array;
	for (let t = 0; t < src.length; t += 3) {
		const tri = [src[t], src[t + 1], src[t + 2]];
		const rs = tri.map(ringOf).filter((r) => r !== null);
		// Side triangles span two adjacent rings; cap triangles hold one ring
		// plus the cap centre. Either way: keep it if its rings are in the band.
		if (rs.every((r) => r >= from && r <= to)) idx.push(...tri.map(take));
	}
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	out.setIndex(idx);
	return out;
}

/** A flat decal facing `normal`, centred on `c`. Carries UVs for its print. */
function decal(c, w, h, normal = [0, 0, 1]) {
	const g = new THREE.PlaneGeometry(w, h);
	g.applyQuaternion(
		new THREE.Quaternion().setFromUnitVectors(
			new THREE.Vector3(0, 0, 1),
			v3(normal)
		)
	);
	g.translate(...c);
	return g;
}
function block(min, max) {
	const size = max.map((v, i) => v - min[i]);
	const g = new THREE.BoxGeometry(...size);
	g.translate(...max.map((v, i) => (v + min[i]) / 2));
	return g;
}

// ------------------------------------------------------------- weighting --

/**
 * Smooth weights along a chain of bones stacked in Y. Each joint blends its
 * two bones over ±`band` metres, so the skin (and whatever is worn over it)
 * bends in a curve instead of kinking.
 */
function chain(y, bones, width = 0.045) {
	const s = bones.map(([, h], k) =>
		k === 0 ? 1 : clamp01((y - (h - width)) / (2 * width))
	);
	return bones.map(([bone], k) => [
		bone,
		s[k] * (k + 1 < s.length ? 1 - s[k + 1] : 1),
	]);
}
const side = (x) => (x >= 0 ? 'Left' : 'Right');
const SPINE = [
	['Hips', HEAD.Hips[1]],
	['Spine', HEAD.Spine[1]],
	['Spine1', HEAD.Spine1[1]],
	['Spine2', HEAD.Spine2[1]],
];

// Every garment reuses the weights of the skin it covers. Linear-blend
// skinning moves a point and its outward offset almost identically when both
// carry the same weights, so a garment built as "the body plus ease" stays
// outside the body through every bend. That is the whole anti-clipping story.
function torsoWeights(x, y) {
	let w = chain(y, SPINE);
	// Trapezius and the top of the chest ride the clavicles.
	const yoke = clamp01((Math.abs(x) - 0.09) / 0.06) * clamp01((y - 1.4) / 0.05);
	if (yoke > 0)
		w = [
			...w.map(([b, v]) => [b, v * (1 - yoke)]),
			[`${side(x)}Shoulder`, yoke],
		];
	// The glutes stretch with the thigh.
	const glute =
		0.35 * clamp01((0.94 - y) / 0.09) * clamp01((Math.abs(x) - 0.03) / 0.08);
	if (glute > 0)
		w = [
			...w.map(([b, v]) => [b, v * (1 - glute)]),
			[`${side(x)}UpLeg`, glute],
		];
	return w;
}
// Written out rather than via chain(): Y DEcreases down a leg.
function legChain(x, y) {
	const s = side(x);
	const hip = clamp01((y - 0.84) / 0.1); // 1 at the hip, 0 below the gluteal fold
	const knee = clamp01((y - (HEAD.LeftLeg[1] - 0.035)) / 0.07); // 1 above the knee
	const ankle = clamp01((y - (HEAD.LeftFoot[1] - 0.02)) / 0.05); // 1 above the ankle
	return [
		['Hips', hip],
		[`${s}UpLeg`, (1 - hip) * knee],
		[`${s}Leg`, (1 - knee) * ankle],
		[`${s}Foot`, 1 - ankle],
	];
}
function armWeights(x, y) {
	const s = side(x);
	const shoulder = clamp01((y - 1.4) / 0.07); // 1 at the top of the deltoid
	const elbow = clamp01((y - (HEAD.LeftForeArm[1] - 0.035)) / 0.07);
	const wrist = clamp01((y - (HEAD.LeftHand[1] - 0.02)) / 0.04);
	return [
		[`${s}Shoulder`, shoulder * 0.7],
		['Spine2', shoulder * 0.3],
		[`${s}Arm`, (1 - shoulder) * elbow],
		[`${s}ForeArm`, (1 - elbow) * wrist],
		[`${s}Hand`, 1 - wrist],
	];
}
const headWeights = (x, y) =>
	chain(
		y,
		[
			['Spine2', 0],
			['Neck', HEAD.Neck[1]],
			['Head', HEAD.Head[1] + 0.02],
		],
		0.03
	);

// ------------------------------------------------------------ the body --
//
// Rings are [y, a (half-width), b (half-depth), dz (forward shift)] for the
// torso and head, and add dx (sideways shift, + = away from the midline) for
// the limbs. The shapes are the landmarks a coach looks at: glutes, the waist,
// the ribcage and pecs, the trapezius slope; deltoid, biceps, the bony elbow,
// the forearm tapering to the wrist; quads with the teardrop above the inner
// knee, the kneecap, the calf belly high and to the inside, the Achilles.

const TORSO = [
	[0.835, 0.1, 0.074, -0.004],
	[0.86, 0.128, 0.094, -0.01],
	[0.9, 0.14, 0.104, -0.014],
	[0.95, 0.141, 0.1, -0.008],
	[1.0, 0.132, 0.09, 0.0],
	[1.06, 0.124, 0.086, 0.004],
	[1.12, 0.126, 0.088, 0.006],
	[1.18, 0.134, 0.093, 0.008],
	[1.25, 0.146, 0.1, 0.01],
	[1.32, 0.154, 0.106, 0.014],
	[1.38, 0.155, 0.102, 0.012],
	[1.42, 0.145, 0.092, 0.006],
	[1.455, 0.118, 0.078, 0.0],
	[1.475, 0.076, 0.062, 0.004],
	[1.488, 0.056, 0.052, 0.006],
];
const LEG = [
	[0.965, 0.078, 0.082, 0.0, 0],
	[0.92, 0.088, 0.092, 0.004, 0],
	[0.86, 0.086, 0.09, 0.008, 0],
	[0.79, 0.08, 0.084, 0.01, 0],
	[0.72, 0.072, 0.076, 0.008, -0.002],
	[0.65, 0.064, 0.068, 0.006, -0.005],
	[0.585, 0.057, 0.061, 0.006, -0.006],
	[0.545, 0.051, 0.056, 0.004, -0.002],
	[0.51, 0.049, 0.054, 0.008, 0],
	[0.475, 0.047, 0.052, 0.003, 0],
	[0.43, 0.05, 0.057, -0.008, -0.002],
	[0.37, 0.052, 0.058, -0.012, -0.004],
	[0.3, 0.045, 0.049, -0.009, -0.002],
	[0.23, 0.036, 0.039, -0.006, 0],
	[0.165, 0.03, 0.032, -0.004, 0],
	[0.115, 0.031, 0.034, -0.002, 0],
	[0.075, 0.03, 0.036, 0.004, 0],
];
const LEG_THIGH_END = 6; // ring index at y .585: above is under the tights
const ARM = [
	[1.462, 0.028, 0.032, 0, -0.032],
	[1.448, 0.047, 0.052, 0, -0.012],
	[1.425, 0.057, 0.06, 0.002, 0.003],
	[1.39, 0.056, 0.058, 0.002, 0.008],
	[1.345, 0.05, 0.052, 0.004, 0.004],
	[1.3, 0.044, 0.049, 0.006, 0],
	[1.25, 0.042, 0.047, 0.004, 0],
	[1.2, 0.039, 0.043, 0.0, 0],
	[1.16, 0.035, 0.037, -0.004, 0],
	[1.125, 0.038, 0.036, 0.002, 0.002],
	[1.08, 0.038, 0.034, 0.002, 0.002],
	[1.02, 0.033, 0.029, 0, 0],
	[0.96, 0.027, 0.022, 0, 0],
	[0.925, 0.024, 0.019, 0, 0],
];
const ARM_TOP_END = 4; // y 1.345: a cap sleeve's reach
const ARM_MID_END = 6; // y 1.25: a short sleeve's reach
const NECK = [
	[1.44, 0.066, 0.06, 0.0],
	[1.485, 0.059, 0.056, 0.006],
	[1.53, 0.055, 0.054, 0.011],
	[1.6, 0.05, 0.05, 0.012],
];

const torsoRing = ([y, a, b, dz], ease = 0, grow = 1) => ({
	p: [0, y, dz],
	a: a * grow + ease,
	b: b + ease,
});
/** The bone line a limb's rings are centred on. */
const legCentre = (y, sx, dx) => {
	const z =
		y > HEAD.LeftLeg[1]
			? 0
			: -0.02 * ((HEAD.LeftLeg[1] - y) / (HEAD.LeftLeg[1] - HEAD.LeftFoot[1]));
	return [sx * (0.095 + dx), y, z];
};
const legRing = ([y, a, b, dz, dx], sx, ease = 0) => {
	const [x, , z] = legCentre(y, sx, dx);
	return { p: [x, y, z + dz], a: a + ease, b: b + ease };
};
const armCentreX = (y) =>
	y >= 1.42 ? 0.18 : y >= 1.14 ? 0.18 + (0.01 * (1.42 - y)) / 0.28 : 0.19;
const armRing = ([y, a, b, dz, dx], sx, ease = 0) => ({
	p: [sx * (armCentreX(y) + dx), y, dz],
	a: a + ease,
	b: b + ease,
});

// Torso, split at the ribs so a singlet can leave the upper chest bare.
const torso = loft(
	TORSO.map((r) => torsoRing(r)),
	{ radial: 28, capStart: true }
);
add('Body_torsoLower', 'Clubmate', band(torso, 0, 7), torsoWeights);
add(
	'Body_torsoUpper',
	'Clubmate',
	band(torso, 7, TORSO.length - 1),
	torsoWeights
);

/**
 * The head: a skull of stacked rings, each a superellipse that narrows toward
 * the front (the jaw closes to a U at the chin), with the face pressed into
 * it: brow, eye sockets and lids, nose, cheekbones, lips and chin. Clay, like
 * the rest of the body, so the face is read from light and shadow alone; the
 * forms are sized to carry at the camera's distance rather than up close.
 */
function headGeometry() {
	// [y, centre z, front depth, back depth, half-width, front taper]
	const RINGS = [
		[1.566, 0.05, 0.016, 0.03, 0.02, 0.4],
		[1.575, 0.04, 0.042, 0.045, 0.034, 0.55],
		[1.588, 0.025, 0.066, 0.06, 0.048, 0.6],
		[1.602, 0.012, 0.07, 0.062, 0.056, 0.5],
		[1.618, 0.004, 0.083, 0.074, 0.061, 0.38],
		[1.64, 0.0, 0.088, 0.088, 0.065, 0.28],
		[1.665, -0.002, 0.088, 0.098, 0.069, 0.2],
		[1.69, -0.004, 0.094, 0.104, 0.072, 0.16],
		[1.712, -0.006, 0.098, 0.105, 0.074, 0.14],
		[1.735, -0.008, 0.094, 0.1, 0.072, 0.12],
		[1.758, -0.009, 0.082, 0.088, 0.066, 0.1],
		[1.776, -0.009, 0.066, 0.07, 0.056, 0.08],
		[1.788, -0.009, 0.046, 0.048, 0.04, 0.05],
		[1.796, -0.009, 0.022, 0.022, 0.018, 0.02],
		[1.799, -0.009, 0.006, 0.006, 0.005, 0],
	];
	const profile = RINGS.map((_, k) =>
		spline(
			RINGS.map((r) => [r[0], r[k]]),
			(RINGS[1][k] - RINGS[0][k]) / (RINGS[1][0] - RINGS[0][0]),
			0
		)
	);
	const gauss = (dx, dy, sx, sy) =>
		Math.exp(-((dx / sx) ** 2) - (dy / sy) ** 2);
	const nose = spline(
		[
			[1.632, 0],
			[1.6365, 0.006],
			[1.641, 0.017],
			[1.646, 0.0215],
			[1.652, 0.02],
			[1.662, 0.0145],
			[1.674, 0.0085],
			[1.686, 0.003],
			[1.694, 0],
		],
		0,
		0
	);
	const noseWidth = spline(
		[
			[1.632, 0.012],
			[1.642, 0.012],
			[1.652, 0.0095],
			[1.67, 0.0075],
			[1.694, 0.007],
		],
		0,
		0
	);
	/** How far the face stands proud of the skull at (x, y), metres. */
	const relief = (x, y) => {
		const ax = Math.abs(x);
		const inNose = y > 1.632 && y < 1.694;
		return (
			(inNose ? nose(y) * Math.exp(-((x / noseWidth(y)) ** 2)) : 0) +
			0.0065 * gauss(ax - 0.0135, y - 1.6405, 0.0055, 0.0045) - // nostril wings
			0.0095 * gauss(ax - 0.032, y - 1.6835, 0.016, 0.0105) + // eye sockets
			0.0058 * gauss(ax - 0.031, y - 1.6825, 0.0095, 0.006) + // eyes and lids
			0.0045 * gauss(ax - 0.028, y - 1.6985, 0.022, 0.0055) + // brow
			0.002 * gauss(x, y - 1.696, 0.01, 0.006) +
			0.0045 * gauss(ax - 0.047, y - 1.667, 0.013, 0.0095) - // cheekbones
			0.003 * gauss(ax - 0.047, y - 1.638, 0.013, 0.012) + // under them
			0.003 * gauss(x, y - 1.618, 0.028, 0.016) + // the mouth's mound
			0.0022 * gauss(x, y - 1.6195, 0.016, 0.0035) + // upper lip
			0.0022 * gauss(x, y - 1.6085, 0.014, 0.0035) - // lower lip
			0.001 * gauss(x, y - 1.614, 0.019, 0.002) - // between them
			0.0022 * gauss(x, y - 1.599, 0.017, 0.0035) + // above the chin
			0.007 * gauss(x, y - 1.587, 0.016, 0.008) // chin
		);
	};

	/** The skin at `theta` around the head (0: straight ahead) and height `y`. */
	const surface = (theta, y) => {
		const [, zc, front, back, a, taper] = profile.map((f) => f(y));
		const [s, c] = superCS(theta, Math.cos(theta) > 0 ? 2.4 : 2.1);
		const x = a * s * (1 - taper * Math.max(0, c) ** 2);
		let z = zc + (c > 0 ? front : back) * c;
		if (c > 0) z += relief(x, y) * smoothstep(0, 0.35, c);
		return [x, y, z];
	};
	// Around a ring, samples crowd to the front, where the face is.
	const around = (j, n) => {
		const t = (j / n) * Math.PI * 2;
		return t - 0.5 * Math.sin(t);
	};
	/** Rings of `radial` points, joined; capped at the top, and the bottom if asked. */
	const sheet = (rows, radial, point, capBottom) => {
		const pos = [];
		for (const row of rows)
			for (let j = 0; j < radial; j++) pos.push(...point(row, j));
		const idx = [];
		for (let i = 0; i < rows.length - 1; i++) {
			for (let j = 0; j < radial; j++) {
				const a = i * radial + j;
				const b = i * radial + ((j + 1) % radial);
				idx.push(a, b, a + radial, b, b + radial, a + radial);
			}
		}
		const caps = [[rows.length - 1, false]];
		if (capBottom) caps.push([0, true]);
		for (const [ring, bottom] of caps) {
			const k = pos.length / 3;
			const y = pos[ring * radial * 3 + 1];
			pos.push(0, y, profile[1](y));
			for (let j = 0; j < radial; j++) {
				const a = ring * radial + j;
				const b = ring * radial + ((j + 1) % radial);
				idx.push(...(bottom ? [k, b, a] : [k, a, b]));
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setIndex(idx);
		g.computeVertexNormals();
		return g;
	};

	// Rings close together over the face, sparse over the crown.
	const ys = [];
	for (let y = RINGS[0][0]; y < RINGS.at(-1)[0];) {
		ys.push(y);
		y += y > 1.592 && y < 1.71 ? 0.0028 : 0.005;
	}
	ys.push(RINGS.at(-1)[0]);
	const head = sheet(ys, 48, (y, j) => surface(around(j, 48), y), true);

	// Short hair: the skull from a hairline up, lifted off it along its
	// normals by the hair's thickness, thin at the hairline and fuller on top.
	// The hairline rises a little at the temples, drops to sideburns in front
	// of the ears, arcs over them and runs down to the nape.
	const hairline = spline(
		[
			[0, 1.737],
			[0.35, 1.734],
			[0.62, 1.724],
			[0.95, 1.716],
			[1.16, 1.69],
			[1.27, 1.664],
			[1.36, 1.666],
			[1.46, 1.703],
			[1.75, 1.712],
			[2.05, 1.69],
			[2.45, 1.635],
			[Math.PI, 1.622],
		],
		0,
		0
	);
	const crown = RINGS.at(-1)[0];
	const HAIR_RADIAL = 96;
	const rows = Array.from({ length: 21 }, (_, k) => (k / 20) ** 1.4);
	const hairPoint = (v, j) => {
		const theta = around(j, HAIR_RADIAL);
		const line = hairline(theta > Math.PI ? 2 * Math.PI - theta : theta);
		return surface(theta, line + (crown - line) * v);
	};
	const hair = sheet(rows, HAIR_RADIAL, hairPoint, false);
	const p = hair.attributes.position;
	const n = hair.attributes.normal;
	for (let i = 0; i < p.count; i++) {
		const v = rows[Math.min(rows.length - 1, Math.floor(i / HAIR_RADIAL))];
		const lift = 0.0035 + 0.0055 * smoothstep(0, 0.35, v);
		p.setXYZ(
			i,
			p.getX(i) + n.getX(i) * lift,
			p.getY(i) + n.getY(i) * lift,
			p.getZ(i) + n.getZ(i) * lift
		);
	}
	hair.computeVertexNormals();
	return { head, hair };
}

// Head and neck.
const { head, hair } = headGeometry();
add('Body_head', 'Clubmate', head, rigid('Head'));
add('Hair', 'Hair', hair, rigid('Head'));
add(
	'Body_head',
	'Clubmate',
	loft(
		NECK.map(([y, a, b, dz]) => ({ p: [0, y, dz], a, b })),
		{ radial: 16 }
	),
	headWeights
);

for (const sx of [1, -1]) {
	const s = side(sx);
	// The ear tips back at the top and stands off the head at its back edge.
	const ear = new THREE.SphereGeometry(1, 12, 10);
	ear.scale(0.008, 0.029, 0.018);
	ear.rotateX(-0.2);
	ear.rotateY(-sx * 0.3);
	ear.translate(sx * 0.071, 1.668, -0.012);
	add('Body_head', 'Clubmate', ear, rigid('Head'));

	// Arm, cut into bands so each sleeve length hides exactly what it covers.
	const arm = loft(
		ARM.map((r) => armRing(r, sx)),
		{ radial: 18 }
	);
	add('Body_armTop', 'Clubmate', band(arm, 0, ARM_TOP_END), armWeights);
	add(
		'Body_armMid',
		'Clubmate',
		band(arm, ARM_TOP_END, ARM_MID_END),
		armWeights
	);
	add(
		'Body_arms',
		'Clubmate',
		band(arm, ARM_MID_END, ARM.length - 1),
		armWeights
	);

	// A loose running fist: palm, four curled fingers, the thumb along the
	// top. The palm faces the body; fingers curl toward it.
	const hx = sx * 0.19;
	const med = -sx; // toward the midline
	add(
		'Body_hands',
		'Clubmate',
		loft(
			[
				{ p: [hx, 0.93, 0.002], a: 0.02, b: 0.026 },
				{ p: [hx, 0.905, 0.004], a: 0.021, b: 0.037 },
				{ p: [hx + med * 0.002, 0.872, 0.006], a: 0.021, b: 0.042 },
				{ p: [hx + med * 0.004, 0.846, 0.004], a: 0.019, b: 0.04 },
			],
			{ radial: 16, capEnd: true }
		),
		rigid(`${s}Hand`)
	);
	[
		[0.03, 1],
		[0.011, 1.08],
		[-0.008, 1.0],
		[-0.025, 0.82],
	].forEach(([fz, k]) => {
		const pts = [];
		let p = new THREE.Vector3(hx + med * 0.004, 0.846, fz);
		let angle = 0.15; // from straight down, rotating toward the palm
		const segs = [0.042 * k, 0.027 * k, 0.021 * k];
		const turn = [0.95, 1.15, 0.9];
		pts.push(p.clone());
		segs.forEach((len, i) => {
			const steps = 3;
			for (let st = 0; st < steps; st++) {
				angle += turn[i] / steps;
				p = p
					.clone()
					.add(
						new THREE.Vector3(
							med * Math.sin(angle) * (len / steps),
							-Math.cos(angle) * (len / steps),
							0
						)
					);
				pts.push(p.clone());
			}
		});
		add(
			'Body_hands',
			'Clubmate',
			loft(
				pts.map((q, i) => ({
					p: q.toArray(),
					a: 0.0088 - i * 0.00018,
					b: 0.0082 - i * 0.00016,
				})),
				{ radial: 8, front: [0, 0, 1], capEnd: true }
			),
			rigid(`${s}Hand`)
		);
	});
	add(
		'Body_hands',
		'Clubmate',
		loft(
			[
				{ p: [hx + med * 0.012, 0.905, 0.036], a: 0.011, b: 0.012 },
				{ p: [hx + med * 0.014, 0.878, 0.05], a: 0.0105, b: 0.011 },
				{ p: [hx + med * 0.02, 0.855, 0.048], a: 0.0095, b: 0.0098 },
				{ p: [hx + med * 0.027, 0.848, 0.034], a: 0.0085, b: 0.0088 },
			],
			{ radial: 8, front: [1, 0, 0], capEnd: true }
		),
		rigid(`${s}Hand`)
	);

	// Leg, cut where the tights end.
	const leg = loft(
		LEG.map((r) => legRing(r, sx)),
		{ radial: 20 }
	);
	add('Body_thighTop', 'Clubmate', band(leg, 0, LEG_THIGH_END), legChain);
	add(
		'Body_legs',
		'Clubmate',
		band(leg, LEG_THIGH_END, LEG.length - 1),
		legChain
	);

	// The bare foot, for the Pacer (the runner's is inside a shoe).
	const fx = sx * 0.095;
	add(
		'Body_feet',
		'Clubmate',
		loft(
			[
				{ p: [fx, 0.035, -0.068], a: 0.026, b: 0.03 },
				{ p: [fx, 0.042, -0.04], a: 0.034, b: 0.04 },
				{ p: [fx, 0.036, 0.02], a: 0.038, b: 0.035 },
				{ p: [fx, 0.025, 0.1], a: 0.044, b: 0.024 },
				{ p: [fx, 0.018, 0.15], a: 0.039, b: 0.017 },
				{ p: [fx, 0.014, 0.182], a: 0.024, b: 0.011 },
			],
			{ radial: 14, front: [0, 1, 0], capStart: true, capEnd: true }
		),
		shoeWeights
	);
}

// ------------------------------------------------------------------ tops --
//
// Each top is the torso plus ease, so it follows the chest, ribs and waist it
// sits on, with the torso's own weights. The hem additionally hands part of
// its weight to ClothHem, which the runtime swings on a spring.

function withHem(weigh, looseness) {
	return (x, y, z) => {
		const w = weigh(x, y, z);
		const hem = looseness * clamp01((1.07 - y) / 0.15);
		return hem > 0
			? [...w.map(([b, v]) => [b, v * (1 - hem)]), ['ClothHem', hem]]
			: w;
	};
}

/** Front-surface depth of a garment ring list at `x`, for a decal. */
function surfaceZ(rings, y, x) {
	let i = 0;
	while (i < rings.length - 2 && rings[i + 1].p[1] < y) i++;
	const a = rings[i];
	const b = rings[i + 1];
	const t = clamp01((y - a.p[1]) / (b.p[1] - a.p[1]));
	const rx = a.a + (b.a - a.a) * t;
	const rz = a.b + (b.b - a.b) * t;
	const cz = a.p[2] + (b.p[2] - a.p[2]) * t;
	return cz + rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + 0.004;
}

const TOPS = {
	// Slim technical tee.
	component: {
		looseness: 0.3,
		ease: 0.01,
		hemFlare: 0.006,
		grow: 1,
		sleeveHem: 1.24,
		sleeveEase: 0.011,
		decals: [{ name: 'blkwtr', x: 0, y: 1.34, w: 0.075, h: 0.019 }],
	},
	// Singlet: ends at the upper chest, held up by two straps.
	coda: {
		looseness: 0.45,
		ease: 0.007,
		hemFlare: 0.006,
		grow: 1,
		top: 1.4,
		straps: true,
		decals: [{ name: 'blkwtr', x: 0, y: 1.335, w: 0.085, h: 0.021 }],
	},
	// Washed cotton cut-off: boxy, with a dropped shoulder and a curved hem.
	hoole: {
		looseness: 0.8,
		ease: 0.024,
		hemFlare: 0.01,
		grow: 1.06,
		cap: 1.33,
		sleeveEase: 0.022,
		hemCurve: 0.03,
		decals: [{ name: 'hoole', x: 0.078, y: 1.33, w: 0.075, h: 0.075 }],
	},
	// Performance tee with a relaxed cut and a longer sleeve.
	communion: {
		looseness: 0.45,
		ease: 0.016,
		hemFlare: 0.008,
		grow: 1.02,
		sleeveHem: 1.225,
		sleeveEase: 0.015,
		decals: [
			{ name: 'blkwtr', x: -0.075, y: 1.37, w: 0.062, h: 0.016 },
			{ name: 'nb', x: 0.075, y: 1.37, w: 0.04, h: 0.022 },
		],
	},
};

for (const [id, top] of Object.entries(TOPS)) {
	const node = `Top_${id}`;
	const material = `Fabric_${id}`;
	const weigh = withHem(torsoWeights, top.looseness);
	const rings = TORSO.filter(([y]) => y >= 0.9 && y <= (top.top ?? 2)).map(
		(r, i) => torsoRing(r, top.ease + (i === 0 ? top.hemFlare : 0), top.grow)
	);
	if (top.hemCurve)
		rings[0].dy = (t) => -top.hemCurve * Math.max(0, Math.cos(t)) ** 2;
	// The neckline sits off the neck a little more than the body does.
	if (!top.top) rings[rings.length - 1].a += 0.008;
	add(node, material, loft(rings, { radial: 28 }), weigh);

	for (const sx of [1, -1]) {
		const reach = top.sleeveHem ?? top.cap;
		if (reach) {
			const armRings = ARM.filter(([y]) => y > reach).map((r) =>
				armRing(r, sx, top.sleeveEase)
			);
			const hemRow = armRing(
				[reach, ...interpolateArm(reach).slice(1)],
				sx,
				top.sleeveEase + 0.004
			);
			add(
				node,
				material,
				loft([...armRings, hemRow], { radial: 18 }),
				armWeights
			);
		}
		if (top.straps) {
			const x = sx * 0.09;
			const pts = [
				[x * 0.97, 1.395, 0.112],
				[x, 1.44, 0.086],
				[x * 1.02, 1.471, 0.03],
				[x * 1.02, 1.471, -0.025],
				[x, 1.44, -0.08],
				[x * 0.97, 1.395, -0.1],
			];
			add(
				node,
				material,
				loft(
					pts.map((p) => ({ p, a: 0.018, b: 0.0045, n: 4 })),
					{ radial: 12, front: [0, 1, 0] }
				),
				weigh
			);
		}
	}
	top.decals.forEach((d, i) => {
		const z = surfaceZ(rings, d.y, d.x);
		add(
			`${node}_decal${i}`,
			`Decal_${d.name}`,
			decal([d.x, d.y, z], d.w, d.h),
			weigh
		);
	});
}

/** An arm ring at any height, interpolated between the authored ones. */
function interpolateArm(y) {
	let i = 0;
	while (i < ARM.length - 2 && ARM[i + 1][0] > y) i++;
	const a = ARM[i];
	const b = ARM[i + 1];
	const t = clamp01((a[0] - y) / (a[0] - b[0]));
	return a.map((v, k) => v + (b[k] - v) * t);
}

// ---------------------------------------------------------------- bottoms --

// Half tight, 9" inseam: the pelvis and legs of the body plus a few
// millimetres, on the body's weights, so it hugs glutes and quads and stretches
// across the hip on a sprinting knee lift. The hem ends just below where the
// bare leg begins.
add(
	'Bottom_tight',
	'Fabric_tight',
	loft(
		TORSO.filter(([y]) => y <= 1.0).map((r) => torsoRing(r, 0.005)),
		{ radial: 28, capStart: true }
	),
	torsoWeights
);
for (const sx of [1, -1]) {
	const rings = LEG.slice(0, LEG_THIGH_END + 1).map((r) =>
		legRing(r, sx, 0.0045)
	);
	rings.push(legRing([0.572, 0.0555, 0.0595, 0.006, -0.006], sx, 0.0055));
	add('Bottom_tight', 'Fabric_tight', loft(rings, { radial: 20 }), legChain);
	// The side pockets: a raised panel on the outer thigh.
	const x = sx * (0.095 + 0.074 + 0.004);
	add(
		'Bottom_tight_pockets',
		'Fabric_tight_pocket',
		block([x - 0.005, 0.665, -0.034], [x + 0.005, 0.79, 0.034]),
		legChain
	);
}
add(
	'Bottom_tight_decal0',
	'Decal_nb',
	decal([0.139, 0.625, 0.045], 0.03, 0.017, [0.6, 0, 0.8]),
	legChain
);

// ----------------------------------------------------------------- shoes --

// FuelCell Rebel v5: a thick, flared midsole with toe spring, a rounded mesh
// upper with a heel counter and laces, black rubber at the heel. Heel and
// midfoot ride the foot bone; the toe box hands over to the toe bone across
// the flex line, so the shoe bends where a real one does at toe-off. The
// soles sit where the ground-contact points in the gait are (see FOOT_POINTS).
function shoeWeights(x, y, z) {
	const toe = clamp01((z - 0.085) / 0.05);
	return [
		[`${side(x)}Foot`, 1 - toe],
		[`${side(x)}ToeBase`, toe],
	];
}
for (const sx of [1, -1]) {
	const fx = sx * 0.095;
	const along = (rows, opts) =>
		loft(
			rows.map(([z, a, b, cy, n]) => ({ p: [fx, cy, z], a, b, n })),
			{ front: [0, 1, 0], ...opts }
		);
	add(
		'Shoes_midsole',
		'Shoe_midsole',
		along(
			[
				[-0.084, 0.044, 0.016, 0.026, 3.5],
				[-0.072, 0.052, 0.024, 0.025, 3.5],
				[-0.03, 0.05, 0.022, 0.022, 3.5],
				[0.03, 0.046, 0.018, 0.019, 3.5],
				[0.09, 0.052, 0.016, 0.017, 3.5],
				[0.14, 0.05, 0.015, 0.02, 3.5],
				[0.175, 0.04, 0.013, 0.026, 3.5],
				[0.196, 0.022, 0.01, 0.032, 3],
			],
			{ radial: 24, capStart: true, capEnd: true }
		),
		shoeWeights
	);
	add(
		'Shoes_upper',
		'Shoe_upper',
		along(
			[
				[-0.08, 0.033, 0.034, 0.082, 2.2],
				[-0.07, 0.04, 0.044, 0.079, 2.2],
				[-0.045, 0.043, 0.046, 0.076, 2.2],
				[-0.01, 0.044, 0.04, 0.072, 2.2],
				[0.03, 0.044, 0.036, 0.066, 2.2],
				[0.08, 0.046, 0.03, 0.058, 2.2],
				[0.12, 0.046, 0.024, 0.052, 2.2],
				[0.155, 0.04, 0.019, 0.047, 2.2],
				[0.178, 0.03, 0.014, 0.044, 2.2],
				[0.19, 0.014, 0.008, 0.042, 2],
			],
			{ radial: 22, capStart: true, capEnd: true }
		),
		shoeWeights
	);
	add(
		'Shoes_outsole',
		'Shoe_outsole',
		along(
			[
				[-0.085, 0.045, 0.006, 0.009, 4],
				[-0.072, 0.053, 0.006, 0.003, 4],
				[-0.03, 0.051, 0.005, 0.003, 4],
			],
			{ radial: 20, capStart: true, capEnd: true }
		),
		shoeWeights
	);
	// Laces across the instep, on top of the upper.
	[0.0, 0.022, 0.044, 0.066].forEach((z, i) => {
		const top = [0.112, 0.105, 0.098, 0.09][i];
		add(
			'Shoes_laces',
			'Shoe_lace',
			block(
				[fx - 0.02, top - 0.002, z - 0.003],
				[fx + 0.02, top + 0.004, z + 0.003]
			),
			shoeWeights
		);
	});
	add(
		`Shoes_decal${sx > 0 ? 0 : 1}`,
		'Decal_n',
		decal([fx + sx * 0.0465, 0.07, 0.045], 0.06, 0.035, [sx, 0, 0]),
		shoeWeights
	);
}

// -------------------------------------------------------------- animation --
//
// The cycles are built from how a runner moves rather than keyed by eye:
// - The hips ride the vertical path a half-sine ground force gives, the
//   standard model of a running stride: lowest at midstance, a ballistic arc
//   through flight, and no kink at footfall or toe-off, because the force
//   (and so the acceleration) is continuous there.
// - A stance foot is PLANTED. Its ball rolls back at one constant speed (the
//   ground's), the heel settles after a midfoot landing and peels off the
//   ball before toe-off, and two-bone IK finds the hip and knee that put the
//   foot there. The runtime's ground speed matches it, so nothing skates.
// - A swing foot follows one smooth path from toe-off through heel recovery
//   and knee drive back to the next footfall, matching the planted foot's
//   position AND velocity at both ends, and the same IK bends the leg to it.
// - Everything else is a sinusoid or a C1 spline: no joint stops dead at a
//   key (cosine easing between keys did, several times a stride).
// - The pelvis turns, drops and sways over the stance leg; the chest turns
//   against it with the arms; the head stays level and looks ahead.

const G = 9.81;
// Samples per stride. Clips play at 0.6-0.75 s a stride, so 60 is about one
// key per rendered frame; LINEAR interpolation between them is then smooth.
const SAMPLES = 60;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const mod1 = (v) => ((v % 1) + 1) % 1;
const qAxis = (axis, angle) =>
	new THREE.Quaternion().setFromAxisAngle(axis, angle);
const qEuler = (x, y, z, order = 'XYZ') =>
	new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, order));

/**
 * A C1 cubic through `points` ([t, value] with value a number or an array):
 * the given end slopes, Catmull-Rom slopes between.
 */
function spline(points, startSlope, endSlope) {
	const vec = (v) => (Array.isArray(v) ? v : [v]);
	const ts = points.map(([t]) => t);
	const vs = points.map(([, v]) => vec(v));
	const n = points.length;
	const slopes = vs.map((v, i) => {
		if (i === 0) return vec(startSlope);
		if (i === n - 1) return vec(endSlope);
		return v.map(
			(_, k) => (vs[i + 1][k] - vs[i - 1][k]) / (ts[i + 1] - ts[i - 1])
		);
	});
	const scalar = !Array.isArray(points[0][1]);
	return (t) => {
		let i = 0;
		while (i < n - 2 && t > ts[i + 1]) i++;
		const h = ts[i + 1] - ts[i];
		const u = (t - ts[i]) / h;
		const u2 = u * u;
		const u3 = u2 * u;
		const out = vs[i].map(
			(v0, k) =>
				(2 * u3 - 3 * u2 + 1) * v0 +
				(u3 - 2 * u2 + u) * h * slopes[i][k] +
				(-2 * u3 + 3 * u2) * vs[i + 1][k] +
				(u3 - u2) * h * slopes[i + 1][k]
		);
		return scalar ? out[0] : out;
	};
}

/**
 * The three cycles. Times are seconds, lengths metres, angles degrees.
 * `contact` is how long a foot is down: what shortens most with speed, and
 * what makes a fast runner look light. `reach` is how far ahead of the hip
 * the ankle lands; the knee is already bent (`kneeContact`) and the shin
 * close to vertical. `strike` is the forefoot-first tilt of a midfoot
 * landing; `kneeOff` and `heelRise` shape the push. `recovery` is the heel
 * tucked under the hips (thigh, knee) and `drive` the knee coming through,
 * each at its share of the swing. Arms swing `arm` either side of `armBack`
 * (elbows drive back more than forward). The pelvis tips forward by `tilt`,
 * turns by `pelvisTurn`, drops by `drop` and sways by `sway`; the spine adds
 * `lean` and turns the chest back by `chestTurn`.
 */
const CLIPS = {
	jog: {
		cadence: 164,
		contact: 0.25,
		reach: 0.18,
		kneeContact: 20,
		kneeOff: 22,
		strike: 3,
		heelRise: 32,
		bob: 0.72,
		recovery: { at: 0.38, thigh: 6, knee: 100 },
		drive: { at: 0.76, thigh: 32, knee: 78 },
		arm: 22,
		armBack: 6,
		elbow: 92,
		elbowSwing: 8,
		tilt: 3,
		lean: 3,
		pelvisTurn: 5,
		chestTurn: 4,
		drop: 3.5,
		sway: 0.012,
	},
	run: {
		cadence: 176,
		contact: 0.205,
		reach: 0.19,
		kneeContact: 20,
		kneeOff: 20,
		strike: 4,
		heelRise: 38,
		bob: 0.72,
		recovery: { at: 0.36, thigh: 8, knee: 114 },
		drive: { at: 0.74, thigh: 42, knee: 86 },
		arm: 32,
		armBack: 7,
		elbow: 86,
		elbowSwing: 10,
		tilt: 3,
		lean: 4,
		pelvisTurn: 6,
		chestTurn: 6,
		drop: 3.5,
		sway: 0.01,
	},
	sprint: {
		cadence: 188,
		contact: 0.165,
		reach: 0.21,
		kneeContact: 20,
		kneeOff: 17,
		strike: 6,
		heelRise: 45,
		bob: 0.72,
		recovery: { at: 0.34, thigh: 14, knee: 132 },
		drive: { at: 0.7, thigh: 58, knee: 96 },
		arm: 50,
		armBack: 8,
		elbow: 80,
		elbowSwing: 12,
		tilt: 4,
		lean: 6,
		pelvisTurn: 8,
		chestTurn: 9,
		drop: 3,
		sway: 0.008,
	},
};

// Leg geometry, straight from the skeleton.
const vecBetween = (a, b) => v3(HEAD[b]).sub(v3(HEAD[a]));
const THIGH = vecBetween('LeftUpLeg', 'LeftLeg');
const SHANK = vecBetween('LeftLeg', 'LeftFoot');
const ANKLE_FROM_BALL = vecBetween('LeftToeBase', 'LeftFoot');
const BALL_HEIGHT = HEAD.LeftToeBase[1];
const L1 = THIGH.length();
const L2 = SHANK.length();
// The shin leans back a touch at rest, so the knee angle that straightens
// the leg is a little below zero.
const SHANK_SKEW = Math.atan2(-SHANK.z, -SHANK.y);
const legSpan = (knee) =>
	Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(knee + SHANK_SKEW));
const kneeFor = (span) =>
	Math.max(
		0,
		Math.acos(
			Math.min(1, Math.max(-1, (span ** 2 - L1 ** 2 - L2 ** 2) / (2 * L1 * L2)))
		) - SHANK_SKEW
	);
const LONGEST = legSpan(0);

/**
 * Two-bone IK in the hips' frame: the thigh and knee rotations that put the
 * ankle at `ankle` (world), the knee bending toward `pole` (world).
 */
function solveLeg(hip, ankle, pole, hipsQ) {
	const inv = hipsQ.clone().invert();
	const u = ankle.clone().sub(hip).applyQuaternion(inv);
	const P = pole.clone().applyQuaternion(inv);
	const knee = kneeFor(u.length());
	const v = SHANK.clone().applyAxisAngle(X_AXIS, knee).add(THIGH);
	const f1 = u.clone().normalize();
	const f2 = P.cross(f1).normalize();
	const f3 = f1.clone().cross(f2);
	const e1 = v.clone().normalize();
	const e3 = e1.clone().cross(X_AXIS);
	const target = new THREE.Matrix4().makeBasis(f1, f2, f3);
	const local = new THREE.Matrix4().makeBasis(e1, X_AXIS, e3);
	return {
		thigh: new THREE.Quaternion().setFromRotationMatrix(
			target.multiply(local.transpose())
		),
		knee: qAxis(X_AXIS, knee),
		span: u.length(),
	};
}

/** Split a rotation into its twist about X (an angle) and what is left. */
function splitX(q) {
	const angle = 2 * Math.atan2(q.x, q.w);
	return { angle, rest: q.clone().multiply(qAxis(X_AXIS, -angle)) };
}

const LANDING_SWEEP = 0.5;
const TOE_OUT = 4 * DEG; // feet and knees point a little out, as they do
const FOOT_LINE = 0.078; // ball of the foot from the midline: a narrow track
const HIP_OFFSET = vecBetween('Hips', 'LeftUpLeg');

/** One clip's motion: every bone's rotation and the hips' position at `p`. */
function gait(c) {
	const T = 120 / c.cadence;
	const s = c.contact / T; // a foot's stance, as a share of the stride
	const tc = c.contact;
	const tf = T / 2 - tc;

	// Vertical: ground force F = Fmax sin(pi t/tc) during stance, nothing in
	// flight. Its impulse carries body weight over the whole step, which
	// fixes Fmax; integrating gives height relative to footfall.
	const A = (Math.PI * G * (tc + tf)) / (2 * tc);
	const v0 = (-G * tf) / 2;
	const rise = (time) => {
		if (time < tc)
			return (
				v0 * time -
				(G * time * time) / 2 +
				((A * tc) / Math.PI) *
					(time - (tc / Math.PI) * Math.sin((Math.PI * time) / tc))
			);
		const f = time - tc;
		return -v0 * f - (G * f * f) / 2;
	};
	// `bob` < 1 is the one liberty: good runners keep the hips quieter than
	// the textbook force curve, and a full-depth sink reads as sitting.
	const vertical = (p) => c.bob * rise(((p * 2) % 1) * (T / 2));

	// The pelvis turns the swinging hip forward, drops on the swing side just
	// after footfall, and sways a centimetre over the stance foot.
	const pelvisYaw = (p) =>
		-c.pelvisTurn * DEG * Math.cos(2 * Math.PI * (p + 0.02));
	const pelvisRoll = (p) =>
		c.drop * DEG * Math.cos(2 * Math.PI * (p - 0.4 * s));
	const sway = (p) => c.sway * Math.cos(2 * Math.PI * (p - s / 2));
	const hipsQ = (p) => qEuler(c.tilt * DEG, pelvisYaw(p), pelvisRoll(p), 'YXZ');

	// Hip height at footfall, from the leg's length there.
	const footQ = (sx, heel) => qEuler(heel * DEG, sx * TOE_OUT, 0, 'YXZ');
	const ankleFromBall = (sx, heel) =>
		ANKLE_FROM_BALL.clone().applyQuaternion(footQ(sx, heel));
	const strikeAnkle = ankleFromBall(1, c.strike);
	const span0 = legSpan(c.kneeContact * DEG);
	const hipJointY =
		BALL_HEIGHT +
		strikeAnkle.y +
		Math.sqrt(
			span0 ** 2 -
				c.reach ** 2 -
				(HIP_OFFSET.x - FOOT_LINE - strikeAnkle.x) ** 2
		);
	const hipsY = hipJointY - HIP_OFFSET.y;
	const hipsPos = (p) => new THREE.Vector3(sway(p), hipsY + vertical(p), 0);
	const hipJoint = (sx, p) =>
		HIP_OFFSET.clone()
			.multiply(new THREE.Vector3(sx, 1, 1))
			.applyQuaternion(hipsQ(p))
			.add(hipsPos(p));

	// Heel pitch through stance (t = 0..1): settle from the strike, flat
	// through midstance, then peel up off the ball, fastest at toe-off.
	const HEEL_FLAT = 0.16;
	const HEEL_LIFT = 0.45;
	const heel = (t) =>
		t < HEEL_FLAT
			? c.strike * (1 - smoothstep(0, HEEL_FLAT, t))
			: t < HEEL_LIFT
				? 0
				: c.heelRise * ((t - HEEL_LIFT) / (1 - HEEL_LIFT)) ** 1.6;

	const legs = {};
	for (const [name, sx, shift] of [
		['Left', 1, 0],
		['Right', -1, 0.5],
	]) {
		const pole = new THREE.Vector3(0, 0, 1).applyAxisAngle(
			Y_AXIS,
			sx * TOE_OUT
		);
		const at = (q) => mod1(q + shift); // leg phase -> master phase

		// Footfall and toe-off fix where the ball is planted and how far it
		// rolls back: that distance over the contact time is the ground speed.
		const h0 = hipJoint(sx, at(0));
		const ballStart = new THREE.Vector3(
			sx * FOOT_LINE,
			BALL_HEIGHT,
			h0.z + c.reach - ankleFromBall(sx, c.strike).z
		);
		const h1 = hipJoint(sx, at(s));
		const offAnkle = ankleFromBall(sx, c.heelRise);
		const offY = BALL_HEIGHT + offAnkle.y;
		const offX = sx * FOOT_LINE + offAnkle.x;
		const span1 = legSpan(c.kneeOff * DEG);
		const offZ =
			h1.z - Math.sqrt(span1 ** 2 - (h1.y - offY) ** 2 - (h1.x - offX) ** 2);
		const roll = ballStart.z - (offZ - offAnkle.z);

		const stance = (t) => {
			const ball = ballStart.clone();
			ball.z -= roll * t;
			const pitch = heel(t);
			return {
				pitch,
				ankle: ball.add(ankleFromBall(sx, pitch)),
				foot: footQ(sx, pitch),
			};
		};

		// The swing path, in leg phase: toe-off -> heel tucked -> knee
		// through -> footfall, with the stance's velocities at both ends.
		const dq = 1e-4;
		const slopeAt = (t0, t1) =>
			stance(t1)
				.ankle.sub(stance(t0).ankle)
				.divideScalar((t1 - t0) * s)
				.toArray();
		const fk = (q, { thigh, knee }, x) => {
			const h = hipJoint(sx, at(q));
			const leg = SHANK.clone()
				.applyAxisAngle(X_AXIS, knee * DEG)
				.add(THIGH)
				.applyAxisAngle(X_AXIS, -thigh * DEG);
			return [x, h.y + leg.y, h.z + leg.z];
		};
		const qR = s + c.recovery.at * (1 - s);
		const qD = s + c.drive.at * (1 - s);
		const ankleX = sx * FOOT_LINE + offAnkle.x;
		const swingPath = spline(
			[
				[s, stance(1).ankle.toArray()],
				[qR, fk(qR, c.recovery, ankleX + sx * 0.012)],
				[qD, fk(qD, c.drive, ankleX + sx * 0.006)],
				[1, stance(0).ankle.toArray()],
			],
			slopeAt(1 - dq, 1),
			// A foot sweeps back before it lands, but not at the full speed of
			// the ground: the landing takes up the rest. Matching it exactly
			// would swing the foot out past a straight knee to wind up.
			slopeAt(0, dq).map((v) => v * LANDING_SWEEP)
		);

		// Solve one stance pose, for the foot's angle at both ends of the swing.
		const solveStance = (t) => {
			const st = stance(t);
			const q = t * s;
			const ik = solveLeg(hipJoint(sx, at(q)), st.ankle, pole, hipsQ(at(q)));
			const shank = hipsQ(at(q)).multiply(ik.thigh).multiply(ik.knee);
			return { ...st, ...ik, footLocal: shank.invert().multiply(st.foot) };
		};
		const off = splitX(solveStance(1).footLocal);
		const on = splitX(solveStance(0).footLocal);
		const ankleSlope = (t0, t1) =>
			(splitX(solveStance(t1).footLocal).angle -
				splitX(solveStance(t0).footLocal).angle) /
			((t1 - t0) * s);
		// After toe-off the foot relaxes toward neutral and flexes up a little
		// before it lands, so the toe clears the ground.
		const ankleAngle = spline(
			[
				[s, off.angle],
				[s + 0.3 * (1 - s), 4 * DEG],
				[s + 0.65 * (1 - s), -4 * DEG],
				[1, on.angle],
			],
			ankleSlope(1 - dq, 1),
			ankleSlope(0, dq)
		);
		// Coming in to land, the foot is aimed at the ground rather than set
		// against the shin: toes up, then level with the strike as it lands.
		const AIM = s + 0.8 * (1 - s);
		const landingPitch = spline(
			[
				[AIM, -8],
				[1, c.strike],
			],
			0,
			0
		);
		const toeAngle = spline(
			[
				[s, -c.heelRise * DEG],
				[s + 0.3 * (1 - s), 0],
				[1, -c.strike * DEG],
			],
			// The toe is fully bent at toe-off and springs back from there.
			0,
			0
		);

		legs[name] = (q) => {
			const p = at(q);
			if (q < s) {
				const st = solveStance(q / s);
				return {
					thigh: st.thigh,
					knee: st.knee,
					foot: st.footLocal,
					toe: qAxis(X_AXIS, -st.pitch * DEG),
					span: st.span,
				};
			}
			const ik = solveLeg(hipJoint(sx, p), v3(swingPath(q)), pole, hipsQ(p));
			const u = (q - s) / (1 - s);
			const rest = off.rest.clone().slerp(on.rest, smoothstep(0, 1, u));
			const relaxed = rest.multiply(qAxis(X_AXIS, ankleAngle(q)));
			const aimed = hipsQ(p)
				.multiply(ik.thigh)
				.multiply(ik.knee)
				.invert()
				.multiply(footQ(sx, landingPitch(Math.max(q, AIM))));
			return {
				...ik,
				foot: relaxed.slerp(aimed, smoothstep(0.55, 0.85, u)),
				toe: qAxis(X_AXIS, toeAngle(q)),
			};
		};
		legs[name].roll = roll;
		legs[name].ballZ0 = ballStart.z;
	}

	// The left arm comes forward with the right knee, a beat behind it.
	const armPhase = mod1(s + 0.8 * (1 - s) - 0.5 + 0.02);
	const swing = (p, lag = 0) => Math.cos(2 * Math.PI * (p - armPhase - lag));
	// The chest turns with the arms, against the pelvis.
	const chestYaw = (p) => -c.chestTurn * DEG * swing(p);
	const bounce = (p) => 1.2 * DEG * Math.cos(4 * Math.PI * (p - s / 2));

	const pose = (p) => {
		const rot = {};
		for (const [name, sx, shift] of [
			['Left', 1, 0],
			['Right', -1, 0.5],
		]) {
			const leg = legs[name](mod1(p - shift));
			rot[`${name}UpLeg`] = leg.thigh;
			rot[`${name}Leg`] = leg.knee;
			rot[`${name}Foot`] = leg.foot;
			rot[`${name}ToeBase`] = leg.toe;

			const a = swing(p + shift); // +1: this arm fully forward
			rot[`${name}Shoulder`] = qEuler(0, -sx * 3 * DEG * a, 0);
			rot[`${name}Arm`] = qEuler(
				(c.armBack - c.arm * a) * DEG,
				-sx * (12 + 5 * a) * DEG,
				sx * (10 + 2 * Math.max(0, -a)) * DEG
			);
			rot[`${name}ForeArm`] = qEuler(
				-(c.elbow + c.elbowSwing * swing(p + shift, 0.03)) * DEG,
				0,
				0
			);
			// Relaxed hands trail the forearm.
			rot[`${name}Hand`] = qEuler(-5 * DEG * swing(p + shift, 0.08), 0, 0);
		}
		const yaw = pelvisYaw(p);
		const roll = pelvisRoll(p);
		const twist = chestYaw(p) - yaw;
		rot.Hips = hipsQ(p);
		rot.Spine = qEuler(c.lean * 0.5 * DEG, twist * 0.25, -roll * 0.6);
		rot.Spine1 = qEuler(
			c.lean * 0.5 * DEG + bounce(p),
			twist * 0.35,
			-roll * 0.4
		);
		rot.Spine2 = qEuler(0, twist * 0.4, 0);
		// The head holds steady and looks a little down the road.
		const level = 4 * DEG - (c.tilt + c.lean) * DEG - bounce(p);
		rot.Neck = qEuler(level * 0.55, -chestYaw(p) * 0.5, 0);
		rot.Head = qEuler(level * 0.45, -chestYaw(p) * 0.4, 0);
		return { rot, hips: hipsPos(p) };
	};
	return { T, s, tc, tf, pose, legs };
}

// A three.js skeleton, to check the result with forward kinematics.
const bones = {};
for (const [name, parent, head] of BONES) {
	const b = new THREE.Bone();
	b.name = name;
	const ph = parent ? HEAD[parent] : [0, 0, 0];
	b.position.set(head[0] - ph[0], head[1] - ph[1], head[2] - ph[2]);
	bones[name] = b;
	if (parent) bones[parent].add(b);
}
// The heel and the toe tip, where the shoe meets the ground.
const FOOT_POINTS = [
	[new THREE.Vector3(0, -0.09, -0.045), 'Foot'],
	[new THREE.Vector3(0, -0.02, 0.045), 'ToeBase'],
];
function applyPose({ rot, hips }) {
	for (const [name, b] of Object.entries(bones))
		b.quaternion.copy(rot[name] ?? new THREE.Quaternion());
	bones.Hips.position.copy(hips);
	bones.Hips.updateMatrixWorld(true);
}
const worldOf = (name, local = new THREE.Vector3()) =>
	local.clone().applyMatrix4(bones[name].matrixWorld);

function buildClip(c) {
	const g = gait(c);
	const times = [];
	const poses = [];
	for (let i = 0; i <= SAMPLES; i++) {
		times.push((i / SAMPLES) * g.T);
		poses.push(g.pose((i % SAMPLES) / SAMPLES));
	}
	return { ...g, times, poses };
}

/** Print what a coach would check, and fail on a foot that skates or digs in. */
function checkClip(name, clip) {
	const { s, T, tc, tf, legs } = clip;
	const N = 240;
	let slip = 0;
	let dig = 0;
	let reach = 0;
	let lowest = Infinity;
	let highest = -Infinity;
	const knee = { stanceMax: 0, swingMax: 0 };
	const roll = legs.Left.roll;
	for (let i = 0; i < N; i++) {
		const p = i / N;
		applyPose(clip.pose(p));
		const hips = bones.Hips.position.y;
		lowest = Math.min(lowest, hips);
		highest = Math.max(highest, hips);
		const leg = legs.Left(p);
		reach = Math.max(reach, leg.span / LONGEST);
		const k = (2 * Math.atan2(leg.knee.x, leg.knee.w)) / DEG;
		const ball = worldOf('LeftToeBase');
		const ground = Math.min(
			...FOOT_POINTS.map(([l, part]) => worldOf(`Left${part}`, l).y)
		);
		if (p < s) {
			knee.stanceMax = Math.max(knee.stanceMax, k);
			// The ball should sit at its height and roll back at one speed.
			const expected = legs.Left.ballZ0 - roll * (p / s);
			slip = Math.max(
				slip,
				Math.abs(ball.y - BALL_HEIGHT),
				Math.abs(ball.z - expected)
			);
		} else {
			knee.swingMax = Math.max(knee.swingMax, k);
			dig = Math.min(dig, ground);
		}
	}
	const speed = roll / tc;
	console.log(
		`${name}: ${(speed * 3.6).toFixed(1)} km/h, stride ${(speed * T).toFixed(2)} m, ` +
			`contact ${(tc * 1000).toFixed(0)} ms / flight ${(tf * 1000).toFixed(0)} ms, ` +
			`bob ${((highest - lowest) * 100).toFixed(1)} cm, ` +
			`knee max ${knee.stanceMax.toFixed(0)}° stance / ${knee.swingMax.toFixed(0)}° swing, ` +
			`reach ${(reach * 100).toFixed(0)}%, ball drift ${(slip * 1000).toFixed(1)} mm, ` +
			`swing toe ${(dig * 1000).toFixed(1)} mm`
	);
	if (reach > 0.995)
		throw new Error(`${name}: a leg is asked to reach past straight`);
	if (slip > 0.002) throw new Error(`${name}: the planted foot drifts`);
	if (dig < -0.004)
		throw new Error(`${name}: the swinging foot digs into the ground`);
}

// ---------------------------------------------------------------- write --

const doc = new Document();
const buffer = doc.createBuffer();
const acc = (type, array) =>
	doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);

const nodes = {};
for (const [name, parent, head] of BONES) {
	const ph = parent ? HEAD[parent] : [0, 0, 0];
	const node = doc
		.createNode(boneNodeName(name))
		.setTranslation([head[0] - ph[0], head[1] - ph[1], head[2] - ph[2]]);
	nodes[name] = node;
	if (parent) nodes[parent].addChild(node);
}
const skin = doc.createSkin('Runner').setSkeleton(nodes.Hips);
const boneIndex = {};
const ibm = [];
BONES.forEach(([name, , head], i) => {
	skin.addJoint(nodes[name]);
	boneIndex[name] = i;
	// Rest rotations are identity, so the inverse bind is a pure translation.
	ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -head[0], -head[1], -head[2], 1);
});
skin.setInverseBindMatrices(acc('MAT4', new Float32Array(ibm)));

const materials = Object.fromEntries(
	Object.entries(MATERIALS).map(([name, { color, roughness }]) => {
		const c = new THREE.Color(color);
		return [
			name,
			doc
				.createMaterial(name)
				.setBaseColorFactor([c.r, c.g, c.b, 1])
				.setRoughnessFactor(roughness)
				.setMetallicFactor(0),
		];
	})
);

/**
 * The four strongest influences (glTF's JOINTS_0/WEIGHTS_0 limit), as bytes
 * that sum to exactly 255: normalised UNSIGNED_BYTE weights are core glTF and
 * a quarter the size of floats, which keeps the file inside its budget.
 */
function influences(list) {
	const merged = new Map();
	for (const [bone, w] of list)
		if (w > 1e-4) merged.set(bone, (merged.get(bone) ?? 0) + w);
	const top = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 4);
	const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
	while (top.length < 4) top.push(['Hips', 0]);
	const bytes = top.map(([, w]) => Math.round((w / sum) * 255));
	bytes[0] += 255 - bytes.reduce((s, b) => s + b, 0);
	return top.map(([bone], k) => {
		if (!(bone in boneIndex)) throw new Error(`unknown bone ${bone}`);
		return [boneIndex[bone], bytes[k]];
	});
}

const armature = doc.createNode('Armature').addChild(nodes.Hips);
const scene = doc.createScene('Scene').addChild(armature);
let vertexCount = 0;
let triangleCount = 0;
for (const [name, { material, pieces }] of NODES) {
	const pos = [];
	const nor = [];
	const uv = [];
	const joints = [];
	const weights = [];
	const idx = [];
	const withUv = material.startsWith('Decal_');
	for (const { geometry: g, weigh } of pieces) {
		const base = pos.length / 3;
		const p = g.attributes.position;
		const n = g.attributes.normal;
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i);
			const y = p.getY(i);
			const z = p.getZ(i);
			pos.push(x, y, z);
			nor.push(n.getX(i), n.getY(i), n.getZ(i));
			if (withUv) uv.push(g.attributes.uv.getX(i), 1 - g.attributes.uv.getY(i));
			for (const [j, w] of influences(weigh(x, y, z))) {
				joints.push(j);
				weights.push(w);
			}
		}
		if (g.index) for (const i of g.index.array) idx.push(base + i);
		else for (let i = 0; i < p.count; i++) idx.push(base + i);
	}
	vertexCount += pos.length / 3;
	triangleCount += idx.length / 3;
	const prim = doc
		.createPrimitive()
		.setAttribute('POSITION', acc('VEC3', new Float32Array(pos)))
		.setAttribute('NORMAL', acc('VEC3', new Float32Array(nor)))
		.setAttribute('JOINTS_0', acc('VEC4', new Uint8Array(joints)))
		.setAttribute(
			'WEIGHTS_0',
			acc('VEC4', new Uint8Array(weights)).setNormalized(true)
		)
		.setIndices(acc('SCALAR', new Uint16Array(idx)))
		.setMaterial(materials[material]);
	if (withUv)
		prim.setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv)));
	const mesh = doc.createMesh(name).addPrimitive(prim);
	scene.addChild(doc.createNode(name).setMesh(mesh).setSkin(skin));
}

for (const [clipName, c] of Object.entries(CLIPS)) {
	const clip = buildClip(c);
	checkClip(clipName, clip);
	const { times, poses } = clip;
	const input = acc('SCALAR', new Float32Array(times));
	const anim = doc.createAnimation(clipName);
	const channel = (node, path, type, values) => {
		const sampler = doc
			.createAnimationSampler()
			.setInput(input)
			.setOutput(acc(type, values))
			.setInterpolation('LINEAR');
		anim
			.addSampler(sampler)
			.addChannel(
				doc
					.createAnimationChannel()
					.setTargetNode(node)
					.setTargetPath(path)
					.setSampler(sampler)
			);
	};
	for (const name of Object.keys(nodes)) {
		if (!poses[0].rot[name]) continue;
		const out = [];
		let prev = null;
		for (const { rot } of poses) {
			const q = rot[name].clone();
			// Keep each key on the same hemisphere as the last, so blending
			// and interpolation always take the short way round.
			if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
			out.push(q.x, q.y, q.z, q.w);
			prev = q;
		}
		channel(nodes[name], 'rotation', 'VEC4', new Float32Array(out));
	}
	const t = [];
	for (const { hips } of poses) t.push(hips.x, hips.y, hips.z);
	channel(nodes.Hips, 'translation', 'VEC3', new Float32Array(t));
}

// Materials are left out of dedup: the decal materials are identical white
// and differ only by NAME, which is how the runtime picks each one's print.
// And prune must keep attributes: nothing in the file textures the decals, so
// it would drop their UVs as unused.
await doc.transform(
	dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
	prune({ keepAttributes: true })
);
const glb = await new NodeIO().writeBinary(doc);
await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, glb);
console.log(
	`wrote ${OUT.pathname} (${(glb.byteLength / 1024).toFixed(1)} KB, ${NODES.size} meshes, ${vertexCount} verts, ${triangleCount} tris)`
);
