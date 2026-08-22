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

// Read the raw cookie value on the client, unparsed. Raw rather than parsed
// because useConsent has to tell "unchanged" from "changed" by comparing
// snapshots, and a freshly parsed object is never === the last one.
export function readConsentRawClient(): string | null {
	if (typeof document === 'undefined') return null;
	const match = document.cookie
		.split('; ')
		.find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
	return match?.split('=').slice(1).join('=') ?? null;
}

// The domain to scope the consent cookie to, or null to leave it host-only.
//
// Without a Domain the cookie is host-only, so a decision made on the apex does
// not apply on www (or vice versa) and the visitor is prompted twice. Stripping
// a leading `www.` yields the registrable domain for this site's shape, and a
// Domain cookie is visible to that domain and its subdomains. Deliberately
// conservative: localhost, IP literals and single-label hosts get null, because
// browsers reject Domain attributes there and a rejected Set-Cookie would lose
// the decision entirely.
function consentCookieDomain(): string | null {
	const host = window.location.hostname;
	if (
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		/^\[?[\d.:]+\]?$/.test(host) ||
		!host.includes('.')
	) {
		return null;
	}
	return host.startsWith('www.') ? host.slice(4) : host;
}

// Persist a decision in the cookie (client-side).
export function writeConsentClient(categories: ConsentCategories): void {
	if (typeof document === 'undefined') return;
	const secure = window.location.protocol === 'https:' ? '; Secure' : '';
	const domain = consentCookieDomain();
	const domainAttr = domain ? `; Domain=${domain}` : '';
	document.cookie = `${CONSENT_COOKIE}=${serializeConsent(categories)}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${domainAttr}${secure}`;
}

// Cookies Google's tags set, by name or prefix: _ga (client id), _ga_<ID>
// (session state), _gid, _gcl_au / _gac_* (Ads click ids).
const TRACKING_COOKIE_PREFIXES = ['_ga', '_gid', '_gat', '_gcl_au', '_gac_'];

/**
 * Expire Google's cookies after consent is withdrawn.
 *
 * `gtag('consent','update',{analytics_storage:'denied'})` stops new writes but
 * does not delete what is already stored — so without this a visitor who
 * accepted and later declined kept their `_ga` client id for up to two years,
 * which is the withdrawal case regulators actually look at.
 *
 * A cookie can only be expired by a Set-Cookie whose name, Path and Domain all
 * match, and gtag writes `_ga` against the registrable domain — which the page
 * cannot read back. So every plausible scoping is attempted; the ones that do
 * not match are inert.
 */
export function clearTrackingCookies(): void {
	if (typeof document === 'undefined') return;
	const names = new Set(
		document.cookie
			.split('; ')
			.map((row) => row.split('=')[0])
			.filter((name) =>
				TRACKING_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix))
			)
	);
	if (names.size === 0) return;

	const host = window.location.hostname;
	const registrable = host.startsWith('www.') ? host.slice(4) : host;
	const scopes = [
		'',
		`; Domain=${host}`,
		`; Domain=.${host}`,
		...(registrable !== host
			? [`; Domain=${registrable}`, `; Domain=.${registrable}`]
			: []),
	];
	for (const name of names) {
		for (const scope of scopes) {
			document.cookie = `${name}=; Path=/; Max-Age=0${scope}`;
		}
	}
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

// Dispatched on the window after a decision is stored, so HeadTrackingCode can
// mount the tracking scripts without a server round trip. The decision is read
// in the browser (see the note there), so re-rendering the server tree — which
// is what router.refresh() used to do — would tell it nothing.
export const CONSENT_CHANGED_EVENT = 'bw-consent-changed';

// Issue one gtag command, whether or not gtag.js has booted yet.
//
// The fallback matters: gtag.js identifies queued commands by the
// `arguments`-object shape Google's documented snippet produces
// (`function gtag(){dataLayer.push(arguments)}`). A plain array is not
// recognized as a command and would be silently ignored — which for a consent
// signal means every category behaves as granted.
function gtagCommand(...args: unknown[]): void {
	const w = window as unknown as {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	};
	const queue = (w.dataLayer = w.dataLayer || []);
	if (w.gtag) {
		w.gtag(...args);
		return;
	}
	const push = function () {
		queue.push(arguments);
	} as (...a: unknown[]) => void;
	push(...args);
}

// Seed Consent Mode v2 defaults from a stored decision. Must reach dataLayer
// before gtag.js processes any `config`, so callers push it from render rather
// than from an effect — see HeadTrackingCode. There is deliberately no
// `wait_for_update`: the default already carries the visitor's real decision,
// so there is nothing pending for gtag to wait on.
//
// Consent Mode honors exactly one `default` per page load, and it guards a
// global (dataLayer) rather than anything React owns — so the once-guard lives
// here, which also lets callers invoke this from render without a ref.
// Later changes go through pushConsentUpdate.
let defaultsSeeded = false;
export function pushConsentDefault(categories: ConsentCategories): void {
	if (typeof window === 'undefined' || defaultsSeeded) return;
	defaultsSeeded = true;
	gtagCommand('consent', 'default', toConsentModeSignals(categories));
}

// Re-assert the decision after the tags have initialized, so a gtag that booted
// before the default was queued still ends up in the right state.
export function pushConsentUpdate(categories: ConsentCategories): void {
	if (typeof window === 'undefined') return;
	gtagCommand('consent', 'update', toConsentModeSignals(categories));
}
