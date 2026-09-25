/**
 * Builds `public/models/runner-v1.glb`, Run Lab's runner: a faceless low-poly
 * mannequin on a Mixamo-named skeleton, wearing the club's kit, with three
 * procedurally authored run cycles (`jog`, `run`, `sprint`). Everything here is
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
 *   place: the hips move only vertically.
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
const HEAD_RINGS = [
	[1.568, 0.03, 0.034, 0.036],
	[1.582, 0.049, 0.058, 0.03],
	[1.607, 0.063, 0.075, 0.02],
	[1.637, 0.071, 0.088, 0.012],
	[1.672, 0.077, 0.096, 0.005],
	[1.707, 0.078, 0.098, -0.002],
	[1.738, 0.073, 0.093, -0.006],
	[1.763, 0.061, 0.08, -0.008],
	[1.781, 0.04, 0.056, -0.008],
	[1.79, 0.018, 0.026, -0.008],
];
const NECK = [
	[1.44, 0.062, 0.058, 0.0],
	[1.485, 0.054, 0.053, 0.006],
	[1.53, 0.049, 0.05, 0.012],
	[1.58, 0.046, 0.048, 0.018],
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

// Head and neck: a sculpted, faceless head with a jaw and ears.
add(
	'Body_head',
	'Clubmate',
	loft(
		HEAD_RINGS.map(([y, a, b, dz]) => ({ p: [0, y, dz], a, b })),
		{ radial: 22, capStart: true, capEnd: true }
	),
	rigid('Head')
);
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
	const ear = new THREE.SphereGeometry(1, 10, 8);
	ear.scale(0.011, 0.027, 0.017);
	ear.translate(sx * 0.077, 1.65, -0.01);
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

/** Periodic cosine-eased interpolation through [phase, value] keys. */
function curve(keys) {
	const k = [...keys].sort((a, b) => a[0] - b[0]);
	return (p) => {
		p = ((p % 1) + 1) % 1;
		let i = k.length - 1;
		while (i > 0 && k[i][0] > p) i--;
		const [p0, v0] = k[i];
		const [p1, v1] = i + 1 < k.length ? k[i + 1] : [k[0][0] + 1, k[0][1]];
		const t = (p - p0) / (p1 - p0 || 1);
		return v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(Math.PI * t));
	};
}

const CLIPS = {
	jog: {
		cadence: 164,
		stance: 0.4,
		fwd: 26,
		back: 14,
		knee: 82,
		kneeStance: 36,
		arm: 24,
		elbow: 92,
		lean: 4,
		lift: 0.018,
	},
	run: {
		cadence: 176,
		stance: 0.34,
		fwd: 40,
		back: 20,
		knee: 104,
		kneeStance: 40,
		arm: 36,
		elbow: 86,
		lean: 6,
		lift: 0.035,
	},
	sprint: {
		cadence: 188,
		stance: 0.27,
		fwd: 62,
		back: 24,
		knee: 126,
		kneeStance: 44,
		arm: 56,
		elbow: 80,
		lean: 9,
		lift: 0.055,
	},
};
const SAMPLES = 40;

function legCurves(c) {
	const s = c.stance;
	const swing = 1 - s;
	return {
		thigh: curve([
			[0, c.fwd * 0.55],
			[s, -c.back],
			[s + swing * 0.62, c.fwd],
		]),
		knee: curve([
			[0, 12],
			[s * 0.45, c.kneeStance],
			[s, 22],
			[s + swing * 0.35, c.knee],
			[0.93, 26],
		]),
		ankle: curve([
			[0, -8],
			[s * 0.45, -12],
			[s, 28],
			[s + swing * 0.2, 12],
			[0.85, -6],
		]),
		toe: curve([
			[0, 0],
			[s * 0.7, 0],
			[s, -30],
			[s + swing * 0.2, 0],
		]),
	};
}

// A three.js skeleton, only to run forward kinematics for the feet.
const bones = {};
for (const [name, parent, head] of BONES) {
	const b = new THREE.Bone();
	b.name = name;
	const ph = parent ? HEAD[parent] : [0, 0, 0];
	b.position.set(head[0] - ph[0], head[1] - ph[1], head[2] - ph[2]);
	bones[name] = b;
	if (parent) bones[parent].add(b);
}
const FOOT_POINTS = [
	[new THREE.Vector3(0, -0.09, -0.045), 'Foot'],
	// The shoe's toe springs up past here, so the last point on the ground
	// is short of the tip.
	[new THREE.Vector3(0, -0.02, 0.045), 'ToeBase'],
];

function poseAt(c, p) {
	const L = legCurves(c);
	const legs = { Left: p, Right: (p + 0.5) % 1 };
	const mid = (c.fwd - c.back) / 2;
	const half = (c.fwd + c.back) / 2;
	const rot = {};
	for (const [side, q] of Object.entries(legs)) {
		rot[`${side}UpLeg`] = [-L.thigh(q) * DEG, 0, 0];
		rot[`${side}Leg`] = [L.knee(q) * DEG, 0, 0];
		rot[`${side}Foot`] = [L.ankle(q) * DEG, 0, 0];
		rot[`${side}ToeBase`] = [L.toe(q) * DEG, 0, 0];
		// The arm swings with the OPPOSITE leg.
		const opp = side === 'Left' ? legs.Right : legs.Left;
		const swing = (L.thigh(opp) - mid) / half; // -1..1
		const sx = side === 'Left' ? 1 : -1;
		rot[`${side}Arm`] = [(-c.arm * swing + 6) * DEG, 0, sx * 9 * DEG];
		rot[`${side}ForeArm`] = [-(c.elbow + 12 * swing) * DEG, 0, 0];
	}
	const leftSwing = (L.thigh(legs.Left) - mid) / half;
	const hipYaw = -7 * leftSwing * DEG;
	rot.Hips = [0, hipYaw, 0];
	rot.Spine = [c.lean * 0.5 * DEG, -hipYaw * 0.5, 0];
	rot.Spine1 = [c.lean * 0.5 * DEG, -hipYaw * 0.6, 0];
	rot.Spine2 = [0, -hipYaw * 0.7, 0];
	rot.Neck = [-c.lean * 0.6 * DEG, 0, 0];
	rot.Head = [-c.lean * 0.3 * DEG, 0, 0];
	return rot;
}

function footMinY(rot) {
	for (const [name, b] of Object.entries(bones)) {
		const r = rot[name] ?? [0, 0, 0];
		b.quaternion.setFromEuler(new THREE.Euler(...r, 'XYZ'));
	}
	bones.Hips.position.set(0, HEAD.Hips[1], 0);
	bones.Hips.updateMatrixWorld(true);
	let min = Infinity;
	for (const side of ['Left', 'Right']) {
		for (const [local, part] of FOOT_POINTS) {
			const w = local.clone().applyMatrix4(bones[`${side}${part}`].matrixWorld);
			min = Math.min(min, w.y);
		}
	}
	return min;
}

function buildClip(c) {
	const times = [];
	const poses = [];
	const hipsY = [];
	for (let i = 0; i <= SAMPLES; i++) {
		const p = (i % SAMPLES) / SAMPLES;
		times.push((i / SAMPLES) * (120 / c.cadence));
		const rot = poseAt(c, p);
		poses.push(rot);
		hipsY.push(HEAD.Hips[1] - footMinY(rot));
	}
	// A foot glued to the ground all cycle would leave no flight. Between
	// toe-off and the other foot's strike, float the hips from one stance
	// height to the next with a lift in the middle.
	for (const [start, end] of [
		[c.stance, 0.5],
		[0.5 + c.stance, 1],
	]) {
		const a = Math.round(start * SAMPLES);
		const b = Math.round(end * SAMPLES);
		for (let i = a + 1; i < b; i++) {
			const t = (i - a) / (b - a);
			hipsY[i] =
				hipsY[a] +
				(hipsY[b % SAMPLES] - hipsY[a]) * t +
				c.lift * Math.sin(Math.PI * t);
		}
	}
	hipsY[SAMPLES] = hipsY[0];
	return { times, poses, hipsY };
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

/** The four strongest influences, normalised: glTF's JOINTS_0/WEIGHTS_0 limit. */
function influences(list) {
	const merged = new Map();
	for (const [bone, w] of list)
		if (w > 1e-4) merged.set(bone, (merged.get(bone) ?? 0) + w);
	const top = [...merged].sort((a, b) => b[1] - a[1]).slice(0, 4);
	const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
	while (top.length < 4) top.push(['Hips', 0]);
	return top.map(([bone, w]) => {
		if (!(bone in boneIndex)) throw new Error(`unknown bone ${bone}`);
		return [boneIndex[bone], w / sum];
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
		.setAttribute('WEIGHTS_0', acc('VEC4', new Float32Array(weights)))
		.setIndices(acc('SCALAR', new Uint16Array(idx)))
		.setMaterial(materials[material]);
	if (withUv)
		prim.setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv)));
	const mesh = doc.createMesh(name).addPrimitive(prim);
	scene.addChild(doc.createNode(name).setMesh(mesh).setSkin(skin));
}

for (const [clipName, c] of Object.entries(CLIPS)) {
	const { times, poses, hipsY } = buildClip(c);
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
		if (!poses.some((r) => r[name])) continue;
		const q = new THREE.Quaternion();
		const out = [];
		for (const r of poses) {
			q.setFromEuler(new THREE.Euler(...(r[name] ?? [0, 0, 0]), 'XYZ'));
			out.push(q.x, q.y, q.z, q.w);
		}
		channel(nodes[name], 'rotation', 'VEC4', new Float32Array(out));
	}
	const t = [];
	for (const y of hipsY) t.push(0, y, 0);
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
