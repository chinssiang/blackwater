'use client';

import { useMediaQuery } from './useMediaQuery';

// Motion's `useReducedMotion` reads the preference once into state and never
// re-renders when it changes (its source carries a TODO saying so), so an
// effect keyed on it can never fire for an OS-level toggle mid-session. This
// subscribes to the media query, so a visitor who turns Reduce Motion on with
// the page open is honoured.
//
// The store contract itself — the subscribe, the snapshot, and the `false`
// server snapshot the client corrects on hydration — lives in `useMediaQuery`,
// which is this hook generalised. Two copies of it meant any fix to it (a
// Safari `addListener` fallback, an SSR guard) had to land twice.
export function usePrefersReducedMotion(): boolean {
	return useMediaQuery('(prefers-reduced-motion: reduce)');
}
