'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
	useProgressActive,
	useProgressStart,
} from '@/components/progress/ProgressProvider';

/**
 * The one writer of the product listing's URL.
 *
 * The filter state lives in the query string, so "apply a filter", "clear the
 * filters" and "go to page 3" are all the same operation: rebuild the search
 * params and navigate. That was written out three times -- in the toolbar, in
 * the empty state one component up, and in the pagination links one component
 * further out -- and the page-reset rule was encoded three different ways, so
 * the toolbar reset pagination and a chip removal in the empty state had to
 * remember to. Here it is once.
 *
 * `buildHref` is separate from `commit` because pagination renders real
 * `<Link href>`s (crawlable, middle-clickable) while the filter controls push
 * imperatively -- the URL is built the same way for both.
 */

/** A param patch: `null`/`''`/`[]` removes the param, anything else sets it. */
export type ParamPatch = Record<string, string[] | string | null>;

/** Every dimension `clearAll` drops. `page` is always reset by `commit`. */
const FILTER_PARAMS = ['category', 'brand', 'badge', 'price'] as const;

const CLEARED: ParamPatch = Object.fromEntries(
	FILTER_PARAMS.map((key) => [key, null])
);

export function useProductFilterParams() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	// The shared transition, not a local `useTransition`: that state is local to
	// each hook CALL, so `ProductFilters` and `ProductBrowser` each held their
	// own flag and only the one that started the navigation ever saw it go
	// true. It also drives the global progress bar.
	const startProgress = useProgressStart();
	const isPending = useProgressActive();

	const currentParams = searchParams.toString();
	// The query string of the last `commit`, held only while its navigation is in
	// flight. `useSearchParams()` reports the PRE-navigation value until the push
	// commits, so a second change inside that window rebuilt from a string that
	// did not have the first one in it and wrote the old value back: with two
	// chips active, removing both back to back left the first one restored. The
	// window is the round trip, 0.2-1.5s on this route.
	//
	// Deliberately not gated on `isPending`: two clicks in the same tick share
	// one render's closures, so `isPending` is still the captured `false` on the
	// second one -- which is exactly the case this exists for. The effect below
	// clears it instead, on the render where the params actually change.
	const pendingParams = useRef<string | null>(null);
	useEffect(() => {
		pendingParams.current = null;
	}, [currentParams]);

	function applyPatch(params: URLSearchParams, patch: ParamPatch) {
		for (const [key, value] of Object.entries(patch)) {
			const isEmpty =
				value == null ||
				value === '' ||
				(Array.isArray(value) && value.length === 0);
			if (isEmpty) params.delete(key);
			else params.set(key, Array.isArray(value) ? value.join(',') : value);
		}
		return params;
	}

	const hrefFrom = (params: URLSearchParams) => {
		const qs = params.toString();
		return qs ? `${pathname}?${qs}` : pathname;
	};

	/**
	 * The params a WRITE should extend: what is on screen, unless a push of our
	 * own has not landed yet. Only ever called from an event handler, which is
	 * what keeps the ref read out of render.
	 */
	const writeBase = () =>
		new URLSearchParams(pendingParams.current ?? currentParams);

	/**
	 * Build a URL from the params as RENDERED -- no pending read, because this
	 * runs during render (pagination links) and should describe the page the
	 * visitor is looking at.
	 */
	function buildHref(patch: ParamPatch): string {
		return hrefFrom(applyPatch(new URLSearchParams(currentParams), patch));
	}

	/**
	 * Navigate with the given patch applied. Always resets pagination: the
	 * shopper's page 3 has no counterpart in a differently-filtered set, and
	 * `scroll: false` because the toolbar they just used is mid-page.
	 */
	function commit(patch: ParamPatch) {
		const params = applyPatch(writeBase(), { page: null, ...patch });
		// Recorded before the push so the next commit in this window extends it
		// rather than the params the browser is still showing.
		pendingParams.current = params.toString();
		startProgress(() => {
			router.push(hrefFrom(params), { scroll: false });
		});
	}

	/**
	 * Add or remove one value inside a comma-separated param.
	 *
	 * Reads the list back out of the params rather than taking it from the
	 * caller's `selected` prop, which is server state and is exactly as stale as
	 * `searchParams` during a push -- so two removals in the SAME dimension, back
	 * to back, each computed from the same starting list and the second undid the
	 * first. Toggling against the write base makes them compose.
	 */
	function toggleValue(key: string, value: string) {
		const list = (writeBase().get(key) ?? '')
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean);
		commit({
			[key]: list.includes(value)
				? list.filter((v) => v !== value)
				: [...list, value],
		});
	}

	function clearAll() {
		commit(CLEARED);
	}

	return { buildHref, commit, toggleValue, clearAll, isPending };
}
