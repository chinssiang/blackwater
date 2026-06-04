'use client';

import { useReducedMotion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';

/**
 * Entrance-reveal props for motion components.
 *
 * Spread onto a `motion.*` element alongside a per-element `transition`:
 *   const reveal = useReveal();
 *   <motion.section {...reveal} transition={{ duration: 0.8 }} />
 *
 * Honors `prefers-reduced-motion`: when the user opts out, `initial` is set to
 * `false` so the element mounts directly in its visible ("show") state with no
 * fade or stagger. The Framer JS animations can't be gated by the CSS-based
 * `motion-reduce:` utility, so this hook is how curated entrances stay
 * accessible while keeping the choreography for everyone else.
 */
export function useReveal() {
	const shouldReduce = useReducedMotion();

	return {
		initial: shouldReduce ? false : 'hide',
		animate: 'show',
		variants: fadeAnim,
	} as const;
}
