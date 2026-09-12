'use client';

import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// Animated wave background for the hero module: a per-pixel CPU shader painted
// into an ImageData buffer at half resolution. The canvas's backing store IS
// that half-resolution buffer; CSS stretches it to the box (`h-full w-full`)
// and the browser's default bilinear scaling does the upsampling for free.
//
// The look is black water at night. The brand palette is achromatic (black,
// greys to #505050, off-white; yellow and green only as accents), so the wave
// is a monochrome luminance field with a barely-there cool cast: slow, with
// thin grey crests over broad near-black troughs that sit at the page
// background. Every knob is a named constant below, the bottom fade included.
//
// This is the only canvas and the only requestAnimationFrame loop in the
// codebase, and it is a real CPU cost while it runs -- roughly 430k pixels of
// trig per frame on a 1920px-wide hero. Three things keep that honest:
//
// - The loop runs only while the canvas intersects the viewport. The hero sits
//   at the top of the page, so once the visitor scrolls past it nothing burns.
// - Under prefers-reduced-motion it paints ONE still frame and never loops.
//   Read in JS rather than a CSS media query, for the reason ui/Carousel.tsx
//   gives (a CSS query cannot reach a JS-driven animation), and through
//   usePrefersReducedMotion rather than Motion's hook, which never re-renders
//   when the preference changes -- this effect re-runs on an OS toggle.
// - The buffer is sized from the canvas's own box via ResizeObserver, not from
//   window.innerWidth as the source snippet did -- the hero is min-h-main, not
//   100vh, and a viewport-sized buffer would pay for pixels never shown.
//
// The canvas is server-rendered empty, so the first putImageData would be a
// hard cut from the section's authored background colour to the wave. The
// `data-ready` attribute is set after the first frame and drives an opacity
// transition; it is a DOM attribute rather than React state so the render loop
// never re-renders the component. Deliberately NOT the `reveal` utility, which
// would start its transition against a still-transparent canvas. An opacity
// fade needs no motion-reduce guard (CLAUDE.md, interaction states).
//
// Not DPR-aware, like the source: the field is soft by nature, the scaled-up
// half-resolution store is invisible in it, and device-pixel sizing would
// quadruple the work for a crispness water does not have.

const SCALE = 2;
const TABLE_SIZE = 1024;
const TABLE_MASK = TABLE_SIZE - 1;
const TWO_PI = Math.PI * 2;

// Tuning. SPEED scales time (the source snippet ran at 1). ZOOM scales the
// field coordinates, so smaller means larger, calmer forms. Luminance is
// BASE + RANGE * crest^CREST (+ a slow DRIFT): BASE is the dark `--background`
// (oklch(0.145), about #0a0a0a) so troughs sit on the page colour, RANGE puts
// crests near the brand dark grey #505050, and CREST > 1 keeps them thin.
// DEPTH darkens toward the bottom and pairs with the `mask-b-from-60%` on the
// canvas below, which dissolves the bottom 40% into whatever the section paints
// beneath; together they are the fade into the next section. TINT is the
// per-channel cast; [1, 1, 1] is pure grey.
const SPEED = 0.25;
const ZOOM = 0.8;
const BASE = 0.04;
const RANGE = 0.22;
const CREST = 2.4;
const DRIFT = 0.02;
const DEPTH = 0.4;
const TINT = [0.96, 0.98, 1] as const;
const TINT_R = TINT[0] * 255;
const TINT_G = TINT[1] * 255;
const TINT_B = TINT[2] * 255;

// Trig by table: the inner loop calls it eleven times per pixel. The index is
// floor(x * TABLE_SCALE) & TABLE_MASK; `&` coerces through ToInt32 and 1024
// divides 2^32, so the mask alone wraps negative and large angles correctly,
// with no modulo or division on the hot path.
const TABLE_SCALE = TABLE_SIZE / TWO_PI;
const SIN_TABLE = new Float32Array(TABLE_SIZE);
const COS_TABLE = new Float32Array(TABLE_SIZE);
for (let i = 0; i < TABLE_SIZE; i++) {
	const angle = (i / TABLE_SIZE) * TWO_PI;
	SIN_TABLE[i] = Math.sin(angle);
	COS_TABLE[i] = Math.cos(angle);
}
const fastSin = (x: number) =>
	SIN_TABLE[Math.floor(x * TABLE_SCALE) & TABLE_MASK];
const fastCos = (x: number) =>
	COS_TABLE[Math.floor(x * TABLE_SCALE) & TABLE_MASK];

// crest^CREST by table too: Math.pow per pixel would cost more than the whole
// trig loop. Indexed by the wave value mapped from -1..1 onto 0..TABLE_MASK.
const CREST_TABLE = new Float32Array(TABLE_SIZE);
for (let i = 0; i < TABLE_SIZE; i++) {
	CREST_TABLE[i] = Math.pow(i / TABLE_MASK, CREST);
}
const CREST_HALF = TABLE_MASK * 0.5;

/**
 * Fills `data`, a `width` x `height` RGBA buffer whose alpha is already 255,
 * with the wave at `time` seconds. No clamps: the field is in -1..1 by
 * construction, the luminance stays inside 0..1 for these constants, and a
 * Uint8ClampedArray clamps on store anyway.
 */
function paintWave(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	time: number
) {
	const t = time * SPEED;
	const tPhase = t * 0.5;
	const tDrift = t * 0.3;
	const uXScale = (2 * ZOOM) / height;
	const uXOffset = (width * ZOOM) / height;
	for (let y = 0; y < height; y++) {
		const uY = ((2 * y - height) / height) * ZOOM;
		const depth = 1 - DEPTH * (y / height);
		let index = y * width * 4;
		for (let x = 0; x < width; x++) {
			const uX = x * uXScale - uXOffset;

			let a = 0;
			let d = 0;
			for (let i = 0; i < 4; i++) {
				a += fastCos(i - d + tPhase - a * uX);
				d += fastSin(i * uY + a);
			}

			// -1..1 -> 0..1, then the power curve: thin bright crests, broad troughs.
			const wave = (fastSin(a) + fastCos(d)) * 0.5;
			const crest = CREST_TABLE[((wave + 1) * CREST_HALF) | 0];
			const drift = DRIFT * fastCos(uX + uY + tDrift);
			const lum = (BASE + RANGE * crest + drift) * depth;

			data[index] = lum * TINT_R;
			data[index + 1] = lum * TINT_G;
			data[index + 2] = lum * TINT_B;
			index += 4;
		}
	}
}

function HeroWave() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const reduce = usePrefersReducedMotion();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let imageData: ImageData | null = null;
		let frame = 0;
		let ready = false;
		const startTime = performance.now();

		const draw = (time: number) => {
			if (!imageData) return;
			paintWave(imageData.data, canvas.width, canvas.height, time);
			ctx.putImageData(imageData, 0, 0);
			if (!ready) {
				ready = true;
				canvas.dataset.ready = '';
			}
		};

		// rAF hands the loop the frame's own timestamp, on the same
		// performance.now() timeline startTime came from.
		const loop = (now: number) => {
			draw((now - startTime) / 1000);
			frame = requestAnimationFrame(loop);
		};
		const start = () => {
			if (!frame) frame = requestAnimationFrame(loop);
		};
		const stop = () => {
			cancelAnimationFrame(frame);
			frame = 0;
		};

		// The observer's initial callback sizes the store before first paint.
		// Assigning width/height clears the canvas, so the store is only touched
		// when its size actually changes (a window drag delivers a callback per
		// frame). A running loop repaints on its next frame; a paused loop --
		// the hero scrolled out of view -- and the reduced-motion still frame
		// have no next frame, so they are repainted here rather than left blank
		// at full opacity for the frame after the hero re-enters view. `ready`
		// keeps the first, pre-loop sizing from paying for a frame the loop is
		// about to paint anyway.
		const resizeObserver = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			const w = Math.max(1, Math.floor(width / SCALE));
			const h = Math.max(1, Math.floor(height / SCALE));
			if (imageData && w === canvas.width && h === canvas.height) return;
			canvas.width = w;
			canvas.height = h;
			imageData = ctx.createImageData(w, h);
			imageData.data.fill(255); // alpha; paintWave writes only RGB
			if (reduce) draw(0);
			else if (ready && !frame) draw((performance.now() - startTime) / 1000);
		});
		resizeObserver.observe(canvas);

		let intersectionObserver: IntersectionObserver | undefined;
		if (!reduce) {
			// The LAST record, not the first: several can be queued for one target
			// before the notify task runs (a fling out of view and back on a main
			// thread this shader is saturating), and acting on the first would stop
			// a loop the last says should be running.
			intersectionObserver = new IntersectionObserver((entries) => {
				if (entries[entries.length - 1].isIntersecting) start();
				else stop();
			});
			intersectionObserver.observe(canvas);
		}

		return () => {
			stop();
			resizeObserver.disconnect();
			intersectionObserver?.disconnect();
		};
	}, [reduce]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden
			data-slot="hero-wave"
			// `mask-b-from-60%`: opaque for the top 60%, dissolving over the bottom
			// 40% into whatever the section paints beneath (the page background, or
			// an authored paper colour). A mask rather than a gradient overlay, so no
			// colour is assumed. Tuned together with DEPTH above.
			className="block h-full w-full mask-b-from-60% opacity-0 transition-opacity duration-700 data-ready:opacity-100"
		/>
	);
}

export { HeroWave };
