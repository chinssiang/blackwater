'use client';

import { useSyncExternalStore } from 'react';
import { SIGNED_IN_HINT_COOKIE } from '@/lib/member/shared';

/*
 * Whether this browser holds a session cookie, for the header's account link
 * and for nothing else. The cookie is written server-side by auth.ts alongside
 * the session cookie itself; see SIGNED_IN_HINT_COOKIE for why it exists and
 * why it must never gate anything.
 */

const CHANGED_EVENT = 'bw:signed-in-hint-changed';

/** Call after a request to /api/auth that may have rewritten the hint. */
export function notifySignedInHintChanged(): void {
	window.dispatchEvent(new Event(CHANGED_EVENT));
}

// Cached, and re-read only when an event says it may have changed: reading
// document.cookie serializes every cookie, and getSnapshot runs on every
// render of the always-mounted header. Same reasoning as useConsent.
let signedIn = false;
let primed = false;

function refresh(): void {
	primed = true;
	signedIn = document.cookie.split('; ').includes(`${SIGNED_IN_HINT_COOKIE}=1`);
}

function getSnapshot(): boolean {
	if (!primed) refresh();
	return signedIn;
}

// focus/visibilitychange pick up a sign-in or sign-out in another tab;
// pageshow covers a bfcache restore.
function subscribe(onChange: () => void): () => void {
	const handle = () => {
		refresh();
		onChange();
	};
	window.addEventListener(CHANGED_EVENT, handle);
	window.addEventListener('focus', handle);
	window.addEventListener('pageshow', handle);
	document.addEventListener('visibilitychange', handle);
	return () => {
		window.removeEventListener(CHANGED_EVENT, handle);
		window.removeEventListener('focus', handle);
		window.removeEventListener('pageshow', handle);
		document.removeEventListener('visibilitychange', handle);
	};
}

/** `false` on the server and during hydration, so the prerender always bakes
 *  the signed-out label. */
export function useSignedInHint(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
