'use client';

import { useEffect, useRef } from 'react';
import { scrollDisable, scrollEnable } from '@/lib/utils';

/**
 * Locks document scroll while `locked` is true, and keeps that lock honest
 * across the page-lifecycle transitions React effect cleanups don't cover.
 *
 * Leaving cross-origin (the cart's Shopify checkout link) freezes the document
 * without running any cleanup, so a back/forward-cache restore would otherwise
 * come back with the overlay still open and `<html>`/`<body>` still locked.
 * `pagehide` drops the lock up front so the restore paints scrollable, and
 * `onRestore` lets the owner close itself on the way back in — releasing the
 * lock alone would leave a visible overlay floating over a scrolling page.
 * Both only fire for the instance that was actually locked at the time.
 *
 * Lives here rather than in each overlay because the lock is global: two
 * consumers with different restore semantics would fight over the same
 * `<html>`/`<body>` styles. It is also why both consumers open their Base UI
 * dialog with `modal="trap-focus"` rather than `modal`: `trap-focus` still
 * traps focus and hides the rest of the page from assistive tech, but leaves
 * Base UI's own scroll lock off, so this hook stays the only writer of those
 * inline styles.
 */
export function useScrollLock(locked: boolean, onRestore?: () => void) {
	// Held in a ref so the listener pair registers once, no matter how the
	// caller spells the callback. Synced in an effect rather than during render;
	// the events it serves only fire long after paint.
	const restore = useRef(onRestore);
	useEffect(() => {
		restore.current = onRestore;
	}, [onRestore]);

	useEffect(() => {
		if (!locked) return;
		scrollDisable();
		return () => scrollEnable();
	}, [locked]);

	// Whether *this* instance dropped a lock it was holding on the way out. Both
	// listeners are registered by every consumer, so without it a restore fires
	// on every overlay at once — the mobile menu closing itself because the cart
	// drawer was the one open — and on plain restores where nothing was open at
	// all. Only the overlay that actually held the lock has anything to restore.
	const dropped = useRef(false);

	useEffect(() => {
		const onHide = () => {
			if (!locked) return;
			dropped.current = true;
			scrollEnable();
		};
		const onShow = (event: PageTransitionEvent) => {
			if (!event.persisted || !dropped.current) return;
			dropped.current = false;
			restore.current?.();
		};
		window.addEventListener('pagehide', onHide);
		window.addEventListener('pageshow', onShow);
		return () => {
			window.removeEventListener('pagehide', onHide);
			window.removeEventListener('pageshow', onShow);
		};
		// `locked` is read inside `onHide`, so the pair re-registers when the
		// overlay opens or closes rather than capturing the mount-time value.
	}, [locked]);
}
