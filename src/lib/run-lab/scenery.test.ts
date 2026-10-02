import { describe, expect, it } from 'vitest';
import {
	MAX_PROPS_PER_KIND,
	PROP_KINDS,
	TILE_COUNT,
	TILE_LENGTH,
	TILE_WIDTH,
	scenery,
	tileSegment,
	tileStart,
	trailHeight,
} from './scenery';
import { TERRAIN_IDS } from './types';

const OFFSETS = Array.from({ length: 600 }, (_, i) => i * 0.37);
const SEGMENTS = Array.from({ length: 80 }, (_, i) => i - 5);

describe('ground tiling', () => {
	it('always reaches 24 m behind and ahead of the runner', () => {
		for (const offset of OFFSETS) {
			const starts = Array.from({ length: TILE_COUNT }, (_, i) =>
				tileStart(i, offset)
			).sort((a, b) => a - b);
			// Contiguous: each tile starts where the one behind it ends.
			starts.slice(1).forEach((s, i) => {
				expect(s - starts[i]).toBeCloseTo(TILE_LENGTH, 6);
			});
			expect(starts[0]).toBeLessThanOrEqual(-24);
			expect(starts[TILE_COUNT - 1] + TILE_LENGTH).toBeGreaterThanOrEqual(24);
		}
	});

	it('names the stretch of world each tile is showing', () => {
		for (const offset of OFFSETS) {
			for (let i = 0; i < TILE_COUNT; i++) {
				expect(tileStart(i, offset) + offset).toBeCloseTo(
					tileSegment(i, offset) * TILE_LENGTH,
					6
				);
			}
		}
	});
});

describe('scenery', () => {
	it('is the same every time a segment comes round', () => {
		for (const terrain of TERRAIN_IDS) {
			expect(scenery(terrain, 17)).toEqual(scenery(terrain, 17));
		}
	});

	it('does not repeat from one segment to the next', () => {
		for (const terrain of TERRAIN_IDS) {
			const a = JSON.stringify(scenery(terrain, 40));
			const b = JSON.stringify(scenery(terrain, 41));
			expect(a).not.toEqual(b);
		}
	});

	it('fits every kind into its instanced mesh', () => {
		for (const terrain of TERRAIN_IDS) {
			for (const segment of SEGMENTS) {
				const props = scenery(terrain, segment);
				for (const kind of PROP_KINDS) {
					const count = props.filter((p) => p.kind === kind).length;
					expect(count).toBeLessThanOrEqual(MAX_PROPS_PER_KIND);
				}
			}
		}
	});

	it('stays on its own tile', () => {
		for (const terrain of TERRAIN_IDS) {
			for (const segment of SEGMENTS) {
				for (const p of scenery(terrain, segment)) {
					expect(Math.abs(p.x) + p.w / 2).toBeLessThanOrEqual(TILE_WIDTH / 2);
					expect(p.z).toBeGreaterThanOrEqual(0);
					expect(p.z).toBeLessThanOrEqual(TILE_LENGTH);
				}
			}
		}
	});

	// Everything scrolls through every z, so a standing prop anywhere in this
	// band would sooner or later run through the runner or the side camera.
	it('keeps standing props out of the runner and the side camera', () => {
		for (const terrain of TERRAIN_IDS) {
			for (const segment of SEGMENTS) {
				for (const p of scenery(terrain, segment)) {
					if (p.kind === 'mark' || p.kind === 'pool') continue;
					if (p.y + p.h <= 0.25) continue;
					const clear = p.x - p.w / 2 > 0.9 || p.x + p.w / 2 < -6.5;
					expect(clear, `${terrain} ${p.kind} at x=${p.x}`).toBe(true);
				}
			}
		}
	});
});

describe('trail surface', () => {
	it('keeps the line the feet run on nearly flat', () => {
		for (let z = 0; z < 200; z += 0.5) {
			expect(Math.abs(trailHeight(0, z))).toBeLessThan(0.02);
		}
	});

	it('rolls away from it', () => {
		const heights = Array.from({ length: 400 }, (_, z) =>
			Math.abs(trailHeight(3, z * 0.5))
		);
		expect(Math.max(...heights)).toBeGreaterThan(0.05);
	});
});
