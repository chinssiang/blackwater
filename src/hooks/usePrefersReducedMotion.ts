'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (onChange: () => void) => {
	const media = window.matchMedia(QUERY);
	media.addEventListener('change', onChange);
	return () => media.removeEventListener('change', onChange);
};
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

// Motion's `useReducedMotion` reads the preference once into state and never
// re-renders when it changes (its source carries a TODO saying so), so an
// effect keyed on it can never fire for an OS-level toggle mid-session. This
// subscribes to the media query, so a visitor who turns Reduce Motion on with
// the page open is honoured. Server snapshot is `false`; the client corrects it
// on hydration, the same shape as every other useSyncExternalStore here.
export function usePrefersReducedMotion(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
