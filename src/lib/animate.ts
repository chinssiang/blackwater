import type { CSSProperties } from 'react';
import type { Variants } from 'motion/react';

// Overrides for the `reveal` utility (globals.css) — the longer, softer entrance
// the product body sections and cards share. The reveal itself is CSS so that
// content is never invisible while waiting on JS; these presets only tune it.
export const REVEAL_SOFT = {
	'--reveal-duration': '0.8s',
	'--reveal-ease': 'cubic-bezier(0, 0.5, 0.5, 1)',
} as CSSProperties;

/**
 * Per-item entrance for a grid or list: `REVEAL_SOFT` plus this item's share of
 * the shared stagger cadence. One definition so the rhythm stays identical
 * across the product, collection and category grids.
 *
 * The delay is capped, because `reveal` holds the element at opacity 0 for the
 * whole delay window (see the utility's comment in globals.css) and a grid is
 * unbounded — `/products/all` alone renders 24 cards, so an uncapped cadence
 * left the last product invisible for 1.38s after paint. The cap keeps the
 * stagger legible across the first row or two and bounds every later item to
 * the same ceiling the buy column uses.
 *
 * `toFixed` because the delay is interpolated straight into the DOM and
 * `3 * 0.06` is `0.18000000000000002` in binary floating point.
 */
const STAGGER_STEP = 0.06;
const STAGGER_MAX_INDEX = 6;

export function revealStagger(index: number): CSSProperties {
	const steps = Math.min(index, STAGGER_MAX_INDEX);
	return {
		...REVEAL_SOFT,
		'--reveal-delay': `${(steps * STAGGER_STEP).toFixed(2)}s`,
	} as CSSProperties;
}

export const fadeAnim = {
	show: {
		opacity: 1,
	},
	hide: {
		opacity: 0,
	},
};

// Mobile menu choreography. Variant functions read a `reduce` custom prop
// (prefers-reduced-motion) so transforms/stagger collapse to instant fades.
const MOBILE_MENU_EASE: [number, number, number, number] = [0, 0.5, 0.5, 1];

// Full-screen panel container — fades the surface in/out.
export const mobileMenuPanel: Variants = {
	hide: { opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
	show: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
};

// Stagger orchestrator for the menu item list (no visual style of its own).
export const mobileMenuList: Variants = {
	hide: (reduce = false) => ({
		transition: reduce
			? {}
			: { staggerChildren: 0.05, staggerDirection: -1 },
	}),
	show: (reduce = false) => ({
		transition: reduce ? {} : { delayChildren: 0.12, staggerChildren: 0.06 },
	}),
};

// Individual menu item — rises + fades in, reverses out.
export const mobileMenuItem: Variants = {
	hide: (reduce = false) => ({ opacity: 0, y: reduce ? 0 : 16 }),
	show: (reduce = false) => ({
		opacity: 1,
		y: 0,
		transition: { duration: reduce ? 0 : 0.5, ease: MOBILE_MENU_EASE },
	}),
};

// Cart drawer — slides in from the right. Unlike the full-screen mobile menu
// this panel sits over the page, so it moves rather than only fading; under
// reduced motion it collapses to the same plain fade.
export const cartPanel: Variants = {
	hide: (reduce = false) => ({
		opacity: 0,
		x: reduce ? 0 : '100%',
		transition: { duration: 0.2, ease: 'easeIn' },
	}),
	show: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.3, ease: MOBILE_MENU_EASE },
	},
};

// Dimmed backdrop behind the cart drawer.
export const cartOverlay: Variants = {
	hide: { opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
	show: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
};
