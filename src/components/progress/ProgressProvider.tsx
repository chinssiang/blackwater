'use client';

import {
	type ReactNode,
	createContext,
	startTransition as reactStartTransition,
	useContext,
	useTransition,
} from 'react';

/**
 * The app's one "something is loading" signal, and the source for
 * `<GlobalProgressBar>`.
 *
 * It exists because `useTransition` state is LOCAL to each hook call. Every
 * caller that wanted to show pending state had to own its own transition, so
 * two components driving the same navigation held two unrelated flags --
 * `ProductFilters` and `ProductBrowser` both called `useProductFilterParams()`
 * and only the one that happened to start the navigation ever saw
 * `isPending: true`. One transition up here is shared by everyone.
 *
 * TWO contexts, not one. The starter keeps a stable identity -- React's
 * `startTransition` from `useTransition` is identity-stable, so it is provided
 * as-is with no wrapper object to memoize -- which means a caller that only
 * ever STARTS work never re-renders. `active` is the boolean, and flips twice
 * per navigation.
 *
 * The bar's 0-1 fill is deliberately NOT here. It changes several times a
 * second, and this provider wraps the entire client tree: a state update here
 * makes React walk every fiber under it looking for consumers. The fill has
 * exactly one reader, so it lives in `<GlobalProgressBar>` instead, where a
 * tick re-renders a leaf and propagates nothing.
 */

type StartProgress = (fn: () => void) => void;

const ProgressStartContext = createContext<StartProgress | null>(null);
const ProgressActiveContext = createContext(false);

export function ProgressProvider({ children }: { children: ReactNode }) {
	const [isPending, startTransition] = useTransition();

	return (
		<ProgressStartContext.Provider value={startTransition}>
			<ProgressActiveContext.Provider value={isPending}>
				{children}
			</ProgressActiveContext.Provider>
		</ProgressStartContext.Provider>
	);
}

/**
 * Run `fn` inside the shared transition, so the global bar reports it for as
 * long as React is working on it. Use it to wrap a router navigation. Stable
 * across renders.
 *
 * Falls back to React's own `startTransition` rather than throwing: consumers
 * like `useProductFilterParams` are ordinary hooks that must keep working in
 * any tree (tests, Studio, a route that does not render the site chrome).
 * Without a provider the work still runs in a transition -- there is just no
 * bar to show it.
 */
export function useProgressStart(): StartProgress {
	return useContext(ProgressStartContext) ?? reactStartTransition;
}

/** Whether anything is in flight. Drives `aria-busy`, and the bar. */
export function useProgressActive(): boolean {
	return useContext(ProgressActiveContext);
}
