import type { Variants } from 'motion/react';

export const pageTransitionFade = {
	initial: {
		opacity: 0,
	},
	animate: {
		opacity: 1,
		transition: { duration: 0.4 },
	},
	exit: {
		opacity: 0,
		transition: { duration: 0.4 },
	},
};

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
