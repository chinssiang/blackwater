'use client';

import { useCallback, useSyncExternalStore } from 'react';

// The server — and the hydration render, since React resolves that one from this
// snapshot too — answers `false` for every query: a prerender has no viewport to
// measure. So the branch a `false` selects is the branch that has to be correct
// with no JS at all. Choose which one that is deliberately at the call site.
const getServerSnapshot = () => false;

/**
 * A media query as reactive state, on `usePrefersReducedMotion`'s model.
 *
 * `useSyncExternalStore` rather than a resize listener: this re-renders a
 * consumer only when the query's ANSWER flips, where `useWindowDimensions`
 * re-renders on every resize frame — 42 calendar cells per frame, for a boolean
 * that changes once. It also needs no `mounted` flag, because React uses
 * `getServerSnapshot` for the hydration render and then re-checks the store.
 *
 * Write widths in `rem`, not `px`, whenever the query has to agree with a
 * Tailwind variant: v4's breakpoints are rem-based, so `(min-width: 1024px)`
 * and `lg:` disagree for anyone whose browser font size is not 16px — which is
 * exactly the case where a JS-chosen branch and a CSS-hidden one can both be
 * wrong at the same time.
 */
export function useMediaQuery(query: string): boolean {
	const subscribe = useCallback(
		(onChange: () => void) => {
			const media = window.matchMedia(query);
			media.addEventListener('change', onChange);
			return () => media.removeEventListener('change', onChange);
		},
		[query]
	);
	const getSnapshot = useCallback(
		() => window.matchMedia(query).matches,
		[query]
	);
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
