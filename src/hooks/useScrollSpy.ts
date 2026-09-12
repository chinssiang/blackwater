'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reads a px-valued custom property off `:root`, e.g. `--h-header`. Returns 0
 * when unset (`--h-announcement` has no value until an announcement renders).
 */
export function readRootPxVar(name: string): number {
	if (typeof window === 'undefined') return 0;
	return (
		parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue(name)
		) || 0
	);
}

/**
 * Scroll-spy for in-page section navs (size guide sidebar, event stations
 * strip): observes the elements named by `ids` and reports the topmost one
 * intersecting an activation band that starts `getTopOffset()` px below the
 * viewport top (i.e. below the sticky stack) and covers the top ~40%.
 *
 * Also keeps the active link visible when the nav is a horizontal overflow
 * strip: assign `containerRef` to the scrolling element and register each
 * link element in `linkRefs` keyed by its id.
 *
 * `getTopOffset` is read once per (re)subscription, so it can derive from CSS
 * vars (see readRootPxVar) without being a hook dependency.
 */
export function useScrollSpy<Container extends HTMLElement>(
	ids: string[],
	getTopOffset: () => number
) {
	const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
	const linkRefs = useRef<Record<string, HTMLElement | null>>({});
	const containerRef = useRef<Container | null>(null);

	// Depend on a joined key, not the array: callers rebuild `ids` from CMS
	// data on every render, and an array dependency would re-run the observer
	// setup each time. getTopOffset is likewise kept out of the deps — it is
	// read once per (re)subscription, on purpose, so an inline arrow at the
	// call site doesn't churn the observer.
	const idKey = ids.join('|');

	useEffect(() => {
		const currentIds = idKey ? idKey.split('|') : [];

		// Reconcile on id changes (live CMS edits can remove or re-key the
		// active element; ids may also arrive after mount): a dangling activeId
		// would otherwise leave no item highlighted until the next scroll.
		setActiveId((current) =>
			current && currentIds.includes(current)
				? current
				: (currentIds[0] ?? null)
		);

		const elements = currentIds
			.map((id) => document.getElementById(id))
			.filter((element): element is HTMLElement => element !== null);
		if (!elements.length) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((entry) => entry.isIntersecting);
				if (!visible.length) return;
				const topmost = visible.reduce((a, b) =>
					a.boundingClientRect.top < b.boundingClientRect.top ? a : b
				);
				setActiveId(topmost.target.id);
			},
			{
				rootMargin: `-${getTopOffset()}px 0px -60% 0px`,
				threshold: 0,
			}
		);

		elements.forEach((element) => observer.observe(element));
		return () => observer.disconnect();
		// getTopOffset is intentionally read once per subscription (see above).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [idKey]);

	// Keep the active link in view while the container scrolls horizontally.
	useEffect(() => {
		if (!activeId) return;
		const link = linkRefs.current[activeId];
		const container = containerRef.current;
		if (!link || !container) return;

		const linkLeft = link.offsetLeft;
		const linkRight = linkLeft + link.offsetWidth;
		const { scrollLeft, clientWidth } = container;
		if (linkLeft < scrollLeft) {
			container.scrollLeft = linkLeft;
		} else if (linkRight > scrollLeft + clientWidth) {
			container.scrollLeft = linkRight - clientWidth;
		}
	}, [activeId]);

	return { activeId, setActiveId, linkRefs, containerRef };
}
