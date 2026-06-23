// Cookie-consent helpers shared by the server (script gating) and the client
// (banner). Consent is stored in a first-party cookie so the server can decide
// whether to render tracking scripts on the initial request — no hydration flash
// and no need to duplicate the script-injection logic on the client.

export const CONSENT_COOKIE = 'bw_consent';

// Bump when the consent categories or policy change so stored decisions are
// treated as stale and visitors are re-prompted.
export const CONSENT_VERSION = 1;

// 6 months, in seconds.
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

// The toggleable categories. "Necessary" is always on and not represented here.
export type ConsentCategories = {
	analytics: boolean;
	marketing: boolean;
};

export type ConsentState = ConsentCategories & {
	v: number;
	ts: number;
};

export const DENY_ALL: ConsentCategories = { analytics: false, marketing: false };
export const GRANT_ALL: ConsentCategories = { analytics: true, marketing: true };

// Parse the raw cookie value into a consent decision, or null when there's no
// valid current-version decision (so the banner should prompt).
export function parseConsentCookie(value?: string | null): ConsentState | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(decodeURIComponent(value));
		if (
			parsed &&
			typeof parsed.analytics === 'boolean' &&
			typeof parsed.marketing === 'boolean' &&
			parsed.v === CONSENT_VERSION
		) {
			return parsed as ConsentState;
		}
	} catch {
		// malformed cookie — treat as no decision
	}
	return null;
}

function serializeConsent(categories: ConsentCategories): string {
	const state: ConsentState = {
		analytics: categories.analytics,
		marketing: categories.marketing,
		v: CONSENT_VERSION,
		ts: Date.now(),
	};
	return encodeURIComponent(JSON.stringify(state));
}

// Read the current decision on the client (e.g. on banner mount).
export function readConsentClient(): ConsentState | null {
	if (typeof document === 'undefined') return null;
	const match = document.cookie
		.split('; ')
		.find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
	return parseConsentCookie(match?.split('=').slice(1).join('='));
}

// Persist a decision in the cookie (client-side).
export function writeConsentClient(categories: ConsentCategories): void {
	if (typeof document === 'undefined') return;
	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${CONSENT_COOKIE}=${serializeConsent(categories)}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
}

// Map our categories to Google Consent Mode v2 signals. Necessary buckets stay
// granted; analytics gates analytics_storage; marketing gates the ad_* signals.
export function toConsentModeSignals(
	categories: ConsentCategories
): Record<string, 'granted' | 'denied'> {
	const granted = (on: boolean) => (on ? 'granted' : 'denied');
	return {
		ad_storage: granted(categories.marketing),
		ad_user_data: granted(categories.marketing),
		ad_personalization: granted(categories.marketing),
		analytics_storage: granted(categories.analytics),
		functionality_storage: 'granted',
		security_storage: 'granted',
		personalization_storage: granted(categories.marketing),
	};
}

// Push a runtime consent update so an already-loaded gtag respects the new
// decision before the server tree re-renders.
export function pushConsentUpdate(categories: ConsentCategories): void {
	if (typeof window === 'undefined') return;
	const w = window as unknown as {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	};
	w.dataLayer = w.dataLayer || [];
	const gtag =
		w.gtag ||
		function gtag(...args: unknown[]) {
			w.dataLayer!.push(args);
		};
	gtag('consent', 'update', toConsentModeSignals(categories));
}
