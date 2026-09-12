'use client';

import { useSyncExternalStore } from 'react';
import {
	CONSENT_CHANGED_EVENT,
	parseConsentCookie,
	readConsentRawClient,
	type ConsentState,
} from '@/lib/consent';

/**
 * The visitor's cookie-consent decision, read in the browser.
 *
 * It is deliberately not read from the cookie on the server: that meant
 * `cookies()` in the root locale layout, and a single dynamic API in a layout
 * opts its whole subtree out of static generation — that one call was what kept
 * every [locale] route server-rendered on demand.
 *
 * Three states, and the distinction matters:
 *   `undefined` — not read yet (the server snapshot, and the hydration render)
 *   `null`      — read, and there is no valid decision, so prompt
 *   ConsentState — read, and this is what the visitor chose
 *
 * Starting at `undefined` is what keeps the prerendered HTML free of both the
 * banner and every tracking script, so a visitor who already decided never sees
 * a banner flash in and out.
 *
 * Writers persist with `writeConsentClient` and then dispatch
 * CONSENT_CHANGED_EVENT; every subscriber re-reads from the cookie.
 */

// Reading document.cookie serializes every cookie on the document, so it is
// done only when something says the value may have changed — never on every
// render. getSnapshot then just returns the cached parse, which also gives
// React the stable reference it needs to avoid re-rendering forever.
let lastRaw: string | null = null;
let lastState: ConsentState | null = null;
let primed = false;

function refresh(): void {
	// Never prime this cache on the server. Module scope in a Node process is
	// shared across concurrent renders, so a decision cached there would be one
	// visitor's answer handed to the next. It cannot happen today — SSR takes
	// getServerSnapshot and never calls getSnapshot — but the guard is what keeps
	// that true if the hook is ever read another way.
	if (typeof document === 'undefined') return;
	const raw = readConsentRawClient();
	if (primed && raw === lastRaw) return;
	primed = true;
	lastRaw = raw;
	lastState = parseConsentCookie(raw);
}

function getSnapshot(): ConsentState | null {
	if (!primed) refresh();
	return lastState;
}

function getServerSnapshot(): undefined {
	return undefined;
}

// One set of DOM listeners for however many components read the hook: the
// handler refreshes the cache once and then fans out, instead of every
// subscriber re-reading document.cookie for the same event.
const subscribers = new Set<() => void>();

function handleExternalChange(): void {
	refresh();
	// Notify unconditionally and let React bail out on an unchanged reference.
	for (const notify of subscribers) notify();
}

// Bound together so an added listener can never outlive its removal. A cookie
// written in another tab fires no event here, and the cookie can expire while
// the app stays open — cases the old server-side read picked up for free on
// every navigation. focus covers side-by-side windows, visibilitychange covers
// tab switching, pageshow covers a bfcache restore.
function toggleListeners(add: boolean): void {
	const fn = add ? 'addEventListener' : 'removeEventListener';
	window[fn](CONSENT_CHANGED_EVENT, handleExternalChange);
	window[fn]('focus', handleExternalChange);
	window[fn]('pageshow', handleExternalChange);
	document[fn]('visibilitychange', handleExternalChange);
}

function subscribe(onStoreChange: () => void): () => void {
	if (subscribers.size === 0) toggleListeners(true);
	subscribers.add(onStoreChange);
	return () => {
		subscribers.delete(onStoreChange);
		if (subscribers.size === 0) toggleListeners(false);
	};
}

export function useConsent(): ConsentState | null | undefined {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
