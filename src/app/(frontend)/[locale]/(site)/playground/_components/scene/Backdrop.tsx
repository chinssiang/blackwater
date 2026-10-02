'use client';

import { memo, useEffect, useMemo } from 'react';
import { seededRandom } from '@/lib/run-lab/math';
import { TERRAIN_IDS, type Terrain } from '@/lib/run-lab/types';
import { BACKGROUND } from './constants';
import { BackSide, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * The far distance: a ring of silhouettes painted once per terrain, standing
 * well past the fog. It does not scroll -- a few metres a second move nothing
 * that far off -- which is also why it can be a closed loop with no seam to
 * come round. Painted in greys a shade off the page, hazing into it at the
 * horizon, so it reads as distance rather than as a backdrop's edge.
 */
export const Backdrop = memo(function Backdrop({
	terrain,
}: {
	terrain: Terrain;
}) {
	const texture = useMemo(() => paint(terrain), [terrain]);
	useEffect(() => () => texture.dispose(), [texture]);
	return (
		<mesh position-y={BOTTOM + HEIGHT / 2} renderOrder={-1}>
			<cylinderGeometry args={[RADIUS, RADIUS, HEIGHT, 128, 1, true]} />
			<meshBasicMaterial
				map={texture}
				side={BackSide}
				transparent
				depthWrite={false}
				fog={false}
				// Exact greys, so the haze meets the page without a step.
				toneMapped={false}
			/>
		</mesh>
	);
});

const RADIUS = 150;
/** The painting repeats this many times around the ring. */
const REPEATS = 3;
const W = 4096;
/** Canvas pixels per metre of ring, both ways. */
const PX = (W * REPEATS) / (2 * Math.PI * RADIUS);
const BOTTOM = -2;
const HEIGHT = 24;
const H = Math.round(HEIGHT * PX);
/** The canvas row at camera height, where the far ground meets the sky. */
const HORIZON = (BOTTOM + HEIGHT - 1.4) * PX;
const BG = parseInt(BACKGROUND.slice(1, 3), 16);

type Ctx = CanvasRenderingContext2D;
type Random = () => number;
// Heights below are canvas pixels above the horizon: 100px is about 3°.
type Painter = (c: Ctx, r: Random) => void;

const grey = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;

/** A fill that hazes toward the page as it nears the horizon. */
function haze(c: Ctx, top: number, tone: number) {
	const g = c.createLinearGradient(0, HORIZON - top, 0, HORIZON);
	g.addColorStop(0, grey(tone));
	g.addColorStop(1, grey(BG + 2));
	return g;
}

/** Draws a shape again a painting's width over wherever it overhangs an edge. */
function wrapped(x: number, width: number, shape: (x: number) => void) {
	shape(x);
	if (x + width > W) shape(x - W);
	if (x < 0) shape(x + W);
}

function ridge(
	c: Ctx,
	r: Random,
	{
		mid,
		amp,
		tone,
		pines = false,
	}: { mid: number; amp: number; tone: number; pines?: boolean }
) {
	// Whole-number frequencies, so the crest meets itself where the painting
	// repeats.
	const waves = [1, 2, 3, 5, 8, 13, 21, 34].map((f) => ({
		f,
		a: r() / f,
		p: r() * 2 * Math.PI,
	}));
	const total = waves.reduce((s, w) => s + w.a, 0);
	const crest = (x: number) =>
		HORIZON -
		mid -
		(amp *
			waves.reduce(
				(s, w) => s + w.a * Math.sin(2 * Math.PI * w.f * (x / W) + w.p),
				0
			)) /
			total;
	c.fillStyle = haze(c, mid + amp, tone);
	c.beginPath();
	c.moveTo(0, H);
	for (let x = 0; x <= W; x += 4) c.lineTo(x, crest(x));
	c.lineTo(W, H);
	c.fill();
	if (!pines) return;
	for (let x = r() * 12; x < W; x += 5 + r() * 14) {
		const h = 8 + r() * 12;
		const y = crest(x) + 2;
		wrapped(x - h * 0.3, h * 0.6, (left) => {
			c.beginPath();
			c.moveTo(left, y);
			c.lineTo(left + h * 0.3, y - h);
			c.lineTo(left + h * 0.6, y);
			c.fill();
		});
	}
}

function city(
	c: Ctx,
	r: Random,
	{
		count,
		tall,
		tone,
		lit,
	}: { count: number; tall: number; tone: number; lit: number }
) {
	for (let i = 0; i < count; i++) {
		const w = 14 + r() * 50;
		// Mostly low, now and then a tower.
		const h = 12 + tall * r() ** 2.5;
		const x = r() * W;
		const fill = haze(c, h, tone + (r() - 0.5) * 4);
		// Some step in at the top, some carry a mast.
		const tier =
			r() < 0.3 ? { w: w * (0.4 + r() * 0.3), h: 6 + r() * 14 } : null;
		const mast = r() < 0.15 ? 8 + r() * 14 : 0;
		wrapped(x, w, (left) => {
			c.fillStyle = fill;
			c.fillRect(left, HORIZON - h, w, H);
			if (tier) {
				c.fillRect(
					left + (w - tier.w) / 2,
					HORIZON - h - tier.h,
					tier.w,
					tier.h
				);
			}
			if (mast)
				c.fillRect(left + w / 2, HORIZON - h - (tier?.h ?? 0) - mast, 1, mast);
		});
		// A few windows still lit, fading into the haze lower down.
		for (let y = HORIZON - h + 4; y < HORIZON - 8; y += 7) {
			for (let wx = x + 3; wx < x + w - 4; wx += 6) {
				if (r() >= lit) continue;
				c.fillStyle = grey(40 + r() * 50, Math.min(1, (HORIZON - y) / 40));
				wrapped(wx, 2, (left) => c.fillRect(left, y, 2, 3));
			}
		}
	}
}

function floodlights(c: Ctx, r: Random) {
	for (let i = 0; i < 3; i++) {
		const x = (i + 0.2 + r() * 0.6) * (W / 3);
		const top = HORIZON - 150 - r() * 30;
		c.fillStyle = haze(c, HORIZON - top, 26);
		c.fillRect(x - 1.5, top, 3, HORIZON - top);
		const glow = c.createRadialGradient(x, top, 0, x, top, 44);
		glow.addColorStop(0, grey(255, 0.14));
		glow.addColorStop(1, grey(255, 0));
		c.fillStyle = glow;
		c.fillRect(x - 44, top - 44, 88, 88);
		c.fillStyle = grey(170);
		c.fillRect(x - 9, top - 6, 18, 7);
	}
}

function treeline(
	c: Ctx,
	r: Random,
	{ height, tone }: { height: number; tone: number }
) {
	c.fillStyle = haze(c, height + 14, tone);
	c.fillRect(0, HORIZON - height, W, H);
	for (let x = 0; x < W; x += 8 + r() * 14) {
		const radius = 7 + r() * 9;
		const y = HORIZON - height - r() * 6;
		wrapped(x - radius, radius * 2, (left) => {
			c.beginPath();
			c.arc(left + radius, y, radius, 0, 2 * Math.PI);
			c.fill();
		});
	}
}

const hills: Painter = (c, r) => {
	ridge(c, r, { mid: 120, amp: 70, tone: 15 });
	ridge(c, r, { mid: 55, amp: 35, tone: 20, pines: true });
};

const PAINTERS: Record<Terrain, Painter> = {
	// A floodlit track: lights over the trees, a low city beyond.
	track(c, r) {
		ridge(c, r, { mid: 85, amp: 45, tone: 14 });
		city(c, r, { count: 60, tall: 40, tone: 17, lit: 0.03 });
		floodlights(c, r);
		treeline(c, r, { height: 26, tone: 21 });
	},
	// Across the river, the city, and the mountains round the basin behind it.
	riverside(c, r) {
		ridge(c, r, { mid: 110, amp: 60, tone: 16 });
		city(c, r, { count: 150, tall: 90, tone: 21, lit: 0.06 });
	},
	// Ridge after ridge, the nearest one wooded.
	trail(c, r) {
		ridge(c, r, { mid: 150, amp: 50, tone: 14 });
		ridge(c, r, { mid: 95, amp: 45, tone: 18 });
		ridge(c, r, { mid: 40, amp: 28, tone: 23, pines: true });
	},
	uphill: hills,
	downhill: hills,
};

function paint(terrain: Terrain) {
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const c = canvas.getContext('2d');
	if (c) {
		const seed = (TERRAIN_IDS.indexOf(terrain) + 1) * 104729;
		PAINTERS[terrain](c, seededRandom(seed));
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.wrapS = RepeatWrapping;
	texture.repeat.x = REPEATS;
	return texture;
}
