'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const SERVER_SNAPSHOT = 0;

/**
 * The current time, refreshed every `intervalMs`.
 *
 * Pages that dim past events read the clock during render, and those pages are
 * prerendered — so the server value is the build time, not "now". Reading it with
 * `useSyncExternalStore` rather than `useState` + a mount `useEffect` means React
 * gets an explicit server snapshot to hydrate against and swaps in the real clock
 * immediately afterwards: no hydration mismatch, and no setState inside an effect
 * (which triggers the cascading render `react-hooks/set-state-in-effect` warns
 * about).
 *
 * During SSR and the hydration render the timestamp is the epoch, so callers see
 * a time before every event — nothing is marked ended until the client takes
 * over a moment later.
 *
 * The client snapshot is quantised to `intervalMs` so repeated reads inside one
 * render pass return an identical value, which `useSyncExternalStore` requires to
 * avoid re-rendering forever.
 */
export function useNow(intervalMs: number): Date {
	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			const timer = setInterval(onStoreChange, intervalMs);
			return () => clearInterval(timer);
		},
		[intervalMs]
	);

	const getSnapshot = useCallback(
		() => Math.floor(Date.now() / intervalMs) * intervalMs,
		[intervalMs]
	);

	const timestamp = useSyncExternalStore(
		subscribe,
		getSnapshot,
		() => SERVER_SNAPSHOT
	);

	return useMemo(() => new Date(timestamp), [timestamp]);
}
