'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import { stegaClean } from '@sanity/client/stega';
import { hasArrayValue } from '@/lib/utils';
import * as gtag from '@/lib/gtag';
import {
	clearTrackingCookies,
	pushConsentDefault,
	pushConsentUpdate,
} from '@/lib/consent';
import { useConsent } from '@/hooks/useConsent';

const IS_PROD = process.env.NODE_ENV === 'production';

// NOTE: no Klaviyo onsite script here. It was blocked outright by our own CSP
// (static.klaviyo.com is absent from script-src, and Klaviyo's endpoints from
// connect-src), so it only ever produced two console errors and did nothing.
// The flows that matter run server-side and are unaffected by CSP:
// /api/newsletter/subscribe and /api/products/back-in-stock both call
// a.klaviyo.com directly. `settingsIntegration.klaviyoCompanyId` stays in the
// schema; re-adding the script would mean widening script-src, connect-src,
// img-src and frame-src.
//
// Exported so HtmlShell can narrow siteData down to this before crossing the
// server/client boundary: everything passed to a client component is serialized
// into the RSC payload, and the tags need two id lists, not the whole site blob.
export type TrackingIntegrations = {
	gaIDs?: string[];
	gtmIDs?: string[];
};

type HeadTrackingCodeProps = {
	integrations?: TrackingIntegrations;
};
export default function HeadTrackingCode({
	integrations,
}: HeadTrackingCodeProps) {
	// stegaClean, because HtmlShell hands us the raw siteData: a measurement id
	// sits at an array index, which the default stega filter does not exclude, so
	// in Draft Mode/Presentation the id arrives padded with invisible characters
	// and both `gtag('config', id)` and `gtag/js?id=` are then misconfigured.
	//
	// Only the first id per vendor is used. @next/third-parties hardcodes its
	// script ids (`_next-ga`, `_next-gtm`) and next/script dedupes on `id`, so a
	// second <GoogleAnalytics> silently never initialized — rendering it implied
	// multi-property support that does not exist.
	const { gaIDs: rawGaIDs, gtmIDs: rawGtmIDs } = integrations || {};
	const gaIDs = useMemo(
		() => (hasArrayValue(rawGaIDs) ? stegaClean(rawGaIDs) : undefined),
		[rawGaIDs]
	);
	const gtmIDs = useMemo(
		() => (hasArrayValue(rawGtmIDs) ? stegaClean(rawGtmIDs) : undefined),
		[rawGtmIDs]
	);
	const gaID = gaIDs?.[0];
	const gtmID = gtmIDs?.[0];

	if (process.env.NODE_ENV !== 'production') {
		if ((gaIDs?.length ?? 0) > 1 || (gtmIDs?.length ?? 0) > 1) {
			console.warn(
				'[HeadTrackingCode] Only the first GA/GTM id is initialized — ' +
					'@next/third-parties keys its script tags by a fixed id, so extra ' +
					'ids are ignored. Use one property per site, or a GTM container.'
			);
		}
	}

	// Read in the browser rather than from the cookie on the server — see the
	// note on useConsent. The gate itself is unchanged (no decision, no scripts);
	// it is just evaluated a tick later, so the tags mount after hydration rather
	// than during HTML parse.
	const consent = useConsent();

	// Consent Mode wants one `default` ahead of everything else, and the GA/GTM
	// children below carry their own inline `gtag('js'); gtag('config', id)`
	// snippet which next/script appends — and an appended *inline* script runs
	// synchronously — from a child effect, which fires before this component's
	// effects. Render is therefore the only phase guaranteed to precede it, so
	// the default is pushed here rather than from an effect. pushConsentDefault
	// is a no-op after the first call, and dataLayer is a plain global queue, so
	// a render React later discards costs nothing.
	if (IS_PROD && consent) {
		pushConsentDefault(consent);
	}

	// Re-assert the decision once the tags have initialized — on the first
	// decision as well as on every later change. This is the correction path the
	// old ConsentBanner.commit() provided: a gtag that booted from cache before
	// the default was queued still ends up in the right state.
	useEffect(() => {
		if (!IS_PROD || !consent) return;
		pushConsentUpdate(consent);
	}, [consent]);

	// Withdrawal cleanup. `consent update: denied` stops new writes but leaves
	// existing identifiers on disk, so anything still there while analytics is
	// denied should not be. Deliberately not keyed on a granted→denied
	// transition: that only catches a withdrawal made in this same page session,
	// and would leave cookies behind for someone who declined on an earlier
	// visit. clearTrackingCookies() returns immediately when there is nothing
	// matching, so running it on every denied render costs a cookie-string read.
	useEffect(() => {
		if (!IS_PROD || !consent || consent.analytics) return;
		clearTrackingCookies();
	}, [consent]);

	// SPA pageviews. This used to live in <Layout> outside the consent gate,
	// which kept reporting after a visitor withdrew consent — window.gtag
	// survives the revoke. Here it fires only while analytics consent stands.
	const pathname = usePathname();
	const analyticsGranted = Boolean(consent?.analytics);
	useEffect(() => {
		if (!IS_PROD || !analyticsGranted || !gaID) return;
		gtag.pageview(pathname, gaID);
	}, [pathname, analyticsGranted, gaID]);

	// Not production, or no decision yet → block all tracking. The banner prompts.
	if (!IS_PROD || !consent) {
		return null;
	}

	// GTM is a tag container, not an analytics tag: it can carry marketing tags
	// as well, and Consent Mode signals gate what runs inside it. Gating it on
	// analytics alone meant a marketing-only visitor loaded nothing at all,
	// while an analytics-only visitor loaded the whole container.
	const loadGtm = consent.analytics || consent.marketing;

	return (
		<>
			{/* Inside the consent gate on purpose: a preconnect performs DNS + TCP +
			    TLS to Google, which discloses the visitor's IP before any tag runs.
			    Warming it unconditionally would contradict the gating the rest of
			    this component does — and warming it with no id configured would
			    disclose it for a request that never follows. */}
			{loadGtm && (gaID || gtmID) && (
				<link rel="preconnect" href="https://www.google-analytics.com" />
			)}
			{consent.analytics && gaID && <GoogleAnalytics gaId={gaID} />}
			{loadGtm && gtmID && <GoogleTagManager gtmId={gtmID} />}
		</>
	);
}
