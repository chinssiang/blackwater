import { mod, seededRandom } from './math';
import type { Terrain } from './types';

/**
 * Run Lab's world as data. The runner stays at the origin facing +Z and the
 * ground scrolls under it in tiles; this module says where each tile sits and
 * what stands on the stretch of world it is showing. It imports no three.js,
 * so the scene folder renders it and the tests can read it.
 */

export const TILE_LENGTH = 12;
export const TILE_COUNT = 5;
export const TILE_WIDTH = 56;

/**
 * Where tile `index` starts along Z once the world has scrolled `offset`
 * metres. Tiles run from three behind the runner to two ahead, so the ground
 * always reaches 24 m either way: past where the fog (complete at 20 m of
 * depth) or any orbit's frame can see, so a tile only ever wraps from the back
 * to the front out of sight.
 */
export function tileStart(index: number, offset: number) {
	return (
		mod(index * TILE_LENGTH - offset, TILE_LENGTH * TILE_COUNT) -
		3 * TILE_LENGTH
	);
}

/** The stretch of world a tile is showing, counted in tiles from the start. */
export function tileSegment(index: number, offset: number) {
	return Math.round((tileStart(index, offset) + offset) / TILE_LENGTH);
}

export const PROP_KINDS = [
	'mark',
	'box',
	'trunk',
	'cone',
	'blob',
	'rock',
	'glow',
	'pool',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];
/** Each tile holds one instanced mesh per kind, this many instances deep. */
export const MAX_PROPS_PER_KIND = 64;

/**
 * One thing on a tile, in tile space: x across (+X is the far side from the
 * side camera), z along the tile (0..TILE_LENGTH), y up; w/h/d are full sizes.
 * A mark is paint and a pool is lamplight, both lying flat; a box, trunk, cone
 * or glow stands on y; a blob or rock is centred on it. `tone` is a grey, so
 * the world stays monochrome.
 */
export type Prop = {
	kind: PropKind;
	x: number;
	y: number;
	z: number;
	w: number;
	h: number;
	d: number;
	rx?: number;
	ry?: number;
	rz?: number;
	tone: number;
};

/** What stands on one stretch of world: the same every time it comes round. */
export function scenery(terrain: Terrain, segment: number): Prop[] {
	const out: Prop[] = [];
	BUILDERS[terrain](seededRandom(segmentSeed(segment)), segment, out);
	return out;
}

/**
 * The trail's ground height at a point in WORLD space (z counted from the
 * start, not the tile), so neighbouring tiles agree at their seam and the
 * waves, at no common period, never come round again.
 */
export function trailHeight(x: number, z: number) {
	const h =
		0.05 * Math.sin(x * 1.7 + Math.sin(z * 0.53) * 1.3) +
		0.035 * Math.cos(z * 1.57 + x * 2.3) +
		0.02 * Math.sin(z * 0.23 + x * 0.6);
	// Keep the line the feet run on nearly flat so they never sink in.
	const away = Math.min(1, Math.abs(x) / 1.2);
	return h * (0.15 + 0.85 * away);
}

type Random = () => number;
type Builder = (r: Random, segment: number, out: Prop[]) => void;

/** Hashed, so neighbouring segments share nothing. */
function segmentSeed(segment: number) {
	let h = Math.imul(segment ^ 0x9e3779b9, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return ((h >>> 0) % 2147483646) + 1;
}

const between = (r: Random, a: number, b: number) => a + (b - a) * r();

function grey(level: number) {
	const l = Math.round(Math.min(255, Math.max(0, level)));
	return (l << 16) | (l << 8) | l;
}

const PAINT = grey(0x3d);
const PAINT_FAINT = grey(0x26);
const WATER = grey(0x0c);

const mark = (
	x: number,
	z: number,
	w: number,
	d: number,
	tone = PAINT,
	y = 0.004
): Prop => ({ kind: 'mark', x, y, z, w, h: 1, d, tone });

/** Paint the full length of the tile, so it meets the next one. */
const line = (x: number, w: number, tone = PAINT) =>
	mark(x, TILE_LENGTH / 2, w, TILE_LENGTH, tone);

const box = (
	x: number,
	y: number,
	z: number,
	w: number,
	h: number,
	d: number,
	tone: number
): Prop => ({ kind: 'box', x, y, z, w, h, d, tone });

function pine(r: Random, x: number, y: number, z: number, out: Prop[]) {
	const h = between(r, 3, 7);
	const tone = grey(between(r, 0x18, 0x24));
	out.push(
		{ kind: 'trunk', x, y, z, w: 0.14, h: 0.3 * h, d: 0.14, tone: grey(0x1e) },
		{
			kind: 'cone',
			x,
			y: y + 0.18 * h,
			z,
			w: 0.45 * h,
			h: 0.55 * h,
			d: 0.45 * h,
			tone,
		},
		{
			kind: 'cone',
			x,
			y: y + 0.45 * h,
			z,
			w: 0.32 * h,
			h: 0.55 * h,
			d: 0.32 * h,
			tone,
		}
	);
}

function roundTree(r: Random, x: number, z: number, out: Prop[]) {
	const h = between(r, 3.6, 5);
	out.push(
		{
			kind: 'trunk',
			x,
			y: 0,
			z,
			w: 0.16,
			h: 0.55 * h,
			d: 0.16,
			tone: grey(0x26),
		},
		{
			kind: 'blob',
			x,
			y: 0.65 * h,
			z,
			w: 0.45 * h,
			h: 0.4 * h,
			d: 0.45 * h,
			ry: r() * Math.PI,
			tone: grey(between(r, 0x1a, 0x24)),
		}
	);
}

const LANE = 1.22;

function hurdle(x: number, z: number, out: Prop[]) {
	const frame = grey(0x55);
	for (const side of [-0.5, 0.5]) {
		out.push(box(x + side, 0, z, 0.04, 0.76, 0.04, frame));
		out.push(box(x + side, 0, z - 0.25, 0.04, 0.03, 0.6, frame));
	}
	out.push(box(x, 0.64, z, 1.04, 0.12, 0.025, grey(0xd0)));
}

const track: Builder = (r, segment, out) => {
	// Nine lines bound eight lanes; the runner holds the one across x = 0. A
	// hurdle mark crosses each line once a tile.
	for (let j = 0; j < 9; j++) {
		const x = (j - 3.5) * LANE;
		out.push(line(x, 0.05), mark(x, 6, 0.25, 0.05, grey(0x5a)));
	}
	// The kerb, and the infield past it.
	out.push(box(5.6, 0, 6, 0.1, 0.06, TILE_LENGTH, grey(0x4a)));
	out.push(box(16.8, 0, 6, 22.2, 0.002, TILE_LENGTH, grey(0x11)));
	// Every fourth tile a line across all eight lanes; two tiles on, the
	// staggered starts of a lap race.
	if (mod(segment, 4) === 0) out.push(mark(0.61, 1, 8 * LANE, 0.05));
	if (mod(segment, 4) === 2) {
		for (let j = 0; j < 8; j++) {
			out.push(mark((j - 3) * LANE, 1 + (7 - j) * 1.1, LANE, 0.05));
		}
	}
	// Now and then a flight of hurdles across the inside lanes.
	if (r() < 0.3) {
		const z = between(r, 2, 10);
		for (const x of [2.44, 3.66, 4.88]) hurdle(x, z, out);
	}
};

const riverside: Builder = (r, _segment, out) => {
	// The path, and the bikeway on the near side with its dashed centre line.
	out.push(line(-1.2, 0.03), line(1.1, 0.03), line(-3.6, 0.03, PAINT_FAINT));
	for (const z of [0.6, 3.6, 6.6, 9.6]) {
		out.push(mark(-2.4, z, 0.03, 1.2, PAINT_FAINT));
	}
	// The river on the far side, past a railing, ruffled by the wind.
	out.push(mark(7, TILE_LENGTH / 2, 9, TILE_LENGTH, WATER, 0.003));
	for (let i = 0; i < 9; i++) {
		out.push(
			mark(
				between(r, 3, 11),
				between(r, 0.8, 11.2),
				0.025,
				between(r, 0.3, 1.4),
				grey(between(r, 0x40, 0x58)),
				0.005
			)
		);
	}
	const metal = grey(0x38);
	out.push(box(2.45, 0.92, 6, 0.05, 0.05, TILE_LENGTH, metal));
	for (let z = 1; z < TILE_LENGTH; z += 2) {
		out.push(box(2.45, 0, z, 0.05, 0.95, 0.05, metal));
	}
	// A lamp every tile, its light pooled on the path.
	out.push(
		box(2.1, 0, 2, 0.06, 3.4, 0.06, metal),
		box(1.8, 3.34, 2, 0.6, 0.04, 0.04, metal),
		{
			kind: 'glow',
			x: 1.55,
			y: 3.26,
			z: 2,
			w: 0.3,
			h: 0.06,
			d: 0.14,
			tone: grey(0xe6),
		},
		{
			kind: 'pool',
			x: 1.2,
			y: 0.005,
			z: 2,
			w: 4.5,
			h: 1,
			d: 4.5,
			tone: grey(0x48),
		}
	);
	// Between lamps, a bench or a tree on the verge.
	const verge = r();
	if (verge < 0.35) {
		const z = between(r, 6, 10);
		const wood = grey(0x30);
		out.push(
			box(1.75, 0.42, z, 0.42, 0.05, 1.6, wood),
			box(1.94, 0.47, z, 0.05, 0.42, 1.6, wood),
			box(1.75, 0, z - 0.7, 0.42, 0.42, 0.05, wood),
			box(1.75, 0, z + 0.7, 0.42, 0.42, 0.05, wood)
		);
	} else if (verge < 0.75) {
		roundTree(r, 2.1, between(r, 5, 11), out);
	}
	// The park on the near side, seen from the front and behind.
	for (let i = 0; i < 2; i++) {
		roundTree(r, between(r, -13, -8.5), between(r, 0.5, 11.5), out);
	}
};

const trail: Builder = (r, segment, out) => {
	const ground = (x: number, z: number) =>
		trailHeight(x, segment * TILE_LENGTH + z);
	const place = (x: number, z: number) => ({ x, y: ground(x, z), z });

	// Pines on both sides, the far side's back in the haze; the near side's
	// show only from the front and behind.
	for (let i = 0; i < 3; i++) {
		const p = place(between(r, 6, 14), between(r, 0.5, 11.5));
		pine(r, p.x, p.y - 0.05, p.z, out);
	}
	for (let i = 0; i < 3; i++) {
		const p = place(between(r, -14, -8.5), between(r, 0.5, 11.5));
		pine(r, p.x, p.y - 0.05, p.z, out);
	}
	// Stones and sticks underfoot, either side of the line the feet run on.
	for (let i = 0; i < 14; i++) {
		const side = r() < 0.5 ? -1 : 1;
		const s = between(r, 0.06, 0.22);
		const p = place(side * between(r, 0.9, 10), between(r, 0.2, 11.8));
		out.push({
			kind: 'rock',
			...p,
			w: s,
			h: s * 0.6,
			d: s * 1.2,
			ry: r() * Math.PI,
			tone: grey(between(r, 0x2e, 0x44)),
		});
	}
	for (let i = 0; i < 6; i++) {
		const side = r() < 0.5 ? -1 : 1;
		const p = place(side * between(r, 0.8, 8), between(r, 0.5, 11.5));
		out.push({
			kind: 'box',
			...p,
			w: 0.03,
			h: 0.03,
			d: between(r, 0.2, 0.7),
			ry: r() * Math.PI,
			tone: grey(0x3a),
		});
	}
	// Grass in tufts: kept short on the near side, where it would hide the feet.
	for (let i = 0; i < 8; i++) {
		const far = r() < 0.6;
		const tuft = place(
			far ? between(r, 1, 9) : -between(r, 1, 6),
			between(r, 0.5, 11.5)
		);
		const tall = far ? 0.4 : 0.16;
		for (let b = 0; b < 4; b++) {
			out.push({
				kind: 'cone',
				x: tuft.x + between(r, -0.06, 0.06),
				y: tuft.y - 0.02,
				z: tuft.z + between(r, -0.06, 0.06),
				w: 0.035,
				h: between(r, tall * 0.45, tall),
				d: 0.035,
				rx: between(r, -0.35, 0.35),
				rz: between(r, -0.35, 0.35),
				tone: grey(between(r, 0x26, 0x34)),
			});
		}
	}
	// A boulder off the trail, and sometimes a fallen trunk along it.
	if (r() < 0.5) {
		const s = between(r, 0.6, 1.3);
		const p = place(between(r, 2.5, 9), between(r, 1, 11));
		out.push({
			kind: 'rock',
			...p,
			w: s,
			h: s * 0.7,
			d: s * 1.1,
			ry: r() * Math.PI,
			tone: grey(0x2c),
		});
	}
	if (r() < 0.35) {
		const d = between(r, 0.25, 0.4);
		// Well back from the trail, or it reads as a slab behind the feet.
		const p = place(between(r, 4, 8), between(r, 1, 8));
		out.push({
			kind: 'trunk',
			...p,
			y: p.y + d / 2,
			w: d,
			h: between(r, 1.5, 3),
			d,
			rx: Math.PI / 2,
			ry: between(r, -0.3, 0.3),
			tone: grey(0x2a),
		});
	}
};

const road: Builder = (r, segment, out) => {
	out.push(line(-1.1, 0.03), line(1.1, 0.03));
	for (const z of [1.5, 4.5, 7.5, 10.5]) {
		out.push(mark(0, z, 0.6, 0.03, PAINT_FAINT));
	}
	// A guardrail on the valley side, a reflector on every other post.
	out.push(box(2.6, 0.45, 6, 0.04, 0.24, TILE_LENGTH, grey(0x44)));
	for (let z = 1; z < TILE_LENGTH; z += 2) {
		out.push(box(2.65, 0, z, 0.08, 0.72, 0.1, grey(0x2c)));
		if (z % 4 === 1) {
			out.push({
				kind: 'glow',
				x: 2.57,
				y: 0.6,
				z,
				w: 0.02,
				h: 0.045,
				d: 0.045,
				tone: grey(0x9a),
			});
		}
	}
	// A kilometre post every eight tiles.
	if (mod(segment, 8) === 0) {
		out.push(
			box(1.5, 0, 6, 0.12, 0.9, 0.12, grey(0xb4)),
			box(1.5, 0.66, 6, 0.13, 0.1, 0.13, grey(0x22))
		);
	}
	// Pines down the slope past the rail and up it on the near side.
	for (let i = 0; i < 2; i++) {
		pine(r, between(r, 6, 14), -0.05, between(r, 0.5, 11.5), out);
	}
	for (let i = 0; i < 3; i++) {
		pine(r, between(r, -14, -8.5), -0.05, between(r, 0.5, 11.5), out);
	}
	for (let i = 0; i < 3; i++) {
		const s = between(r, 0.1, 0.5);
		out.push({
			kind: 'rock',
			x: between(r, 3, 10),
			y: 0,
			z: between(r, 0.5, 11.5),
			w: s,
			h: s * 0.7,
			d: s,
			ry: r() * Math.PI,
			tone: grey(0x30),
		});
	}
};

const BUILDERS: Record<Terrain, Builder> = {
	track,
	riverside,
	trail,
	uphill: road,
	downhill: road,
};
