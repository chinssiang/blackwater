// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
	CONSENT_COOKIE,
	CONSENT_VERSION,
	DENY_ALL,
	GRANT_ALL,
	consentCookieDomain,
	parseConsentCookie,
	readConsentRawClient,
	toConsentModeSignals,
	writeConsentClient,
} from './consent';

function encode(value: unknown): string {
	return encodeURIComponent(JSON.stringify(value));
}

describe('parseConsentCookie', () => {
	it('returns null for an absent cookie', () => {
		expect(parseConsentCookie(undefined)).toBeNull();
		expect(parseConsentCookie('')).toBeNull();
		expect(parseConsentCookie(null)).toBeNull();
	});

	it('returns null for malformed JSON', () => {
		expect(parseConsentCookie('not-json')).toBeNull();
	});

	it('rejects a decision from a stale consent version', () => {
		const stale = encode({
			analytics: true,
			marketing: true,
			v: CONSENT_VERSION + 1,
			ts: Date.now(),
		});
		expect(parseConsentCookie(stale)).toBeNull();
	});

	it('rejects a decision with the wrong value types', () => {
		const bad = encode({
			analytics: 'yes',
			marketing: false,
			v: CONSENT_VERSION,
			ts: Date.now(),
		});
		expect(parseConsentCookie(bad)).toBeNull();
	});

	it('parses a valid current-version decision', () => {
		const valid = encode({
			analytics: true,
			marketing: false,
			v: CONSENT_VERSION,
			ts: 123,
		});
		expect(parseConsentCookie(valid)).toEqual({
			analytics: true,
			marketing: false,
			v: CONSENT_VERSION,
			ts: 123,
		});
	});
});

describe('toConsentModeSignals', () => {
	it('maps analytics to analytics_storage only', () => {
		const signals = toConsentModeSignals({ analytics: true, marketing: false });
		expect(signals.analytics_storage).toBe('granted');
		expect(signals.ad_storage).toBe('denied');
		expect(signals.ad_user_data).toBe('denied');
		expect(signals.ad_personalization).toBe('denied');
		expect(signals.personalization_storage).toBe('denied');
	});

	it('gates all ad signals behind marketing', () => {
		const signals = toConsentModeSignals(GRANT_ALL);
		expect(signals.ad_storage).toBe('granted');
		expect(signals.ad_user_data).toBe('granted');
		expect(signals.ad_personalization).toBe('granted');
		expect(signals.personalization_storage).toBe('granted');
	});

	it('always grants necessary buckets', () => {
		const signals = toConsentModeSignals(DENY_ALL);
		expect(signals.functionality_storage).toBe('granted');
		expect(signals.security_storage).toBe('granted');
	});
});

describe('client cookie round-trip', () => {
	afterEach(() => {
		// A cookie's identity is (name, domain, path), so the delete has to carry
		// the same Domain writeConsentClient derived — otherwise it silently
		// misses and the next test reads this one's decision. Both variants go,
		// because the writer expires the host-only one before writing a scoped
		// one and either may be present.
		const domain = consentCookieDomain();
		document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`;
		if (domain) {
			document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0; Domain=${domain}`;
		}
	});

	// The reader is split in two so useConsent can compare the RAW cookie
	// between snapshots — parsing first would hand useSyncExternalStore a fresh
	// object every time and loop it. The round trip is the composition.
	it('writes a decision the raw reader and parser can recover', () => {
		writeConsentClient({ analytics: true, marketing: false });
		expect(parseConsentCookie(readConsentRawClient())).toMatchObject({
			analytics: true,
			marketing: false,
			v: CONSENT_VERSION,
		});
	});

	it('reads null before any decision is written', () => {
		expect(readConsentRawClient()).toBeNull();
		expect(parseConsentCookie(readConsentRawClient())).toBeNull();
	});
});
