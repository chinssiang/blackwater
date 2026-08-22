'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import { hasArrayValue } from '@/lib/utils';
import * as gtag from '@/lib/gtag';
import { pushConsentDefault, pushConsentUpdate } from '@/lib/consent';
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
	const { gaIDs, gtmIDs } = integrations || {};

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

	// SPA pageviews. This used to live in <Layout> outside the consent gate,
	// which kept reporting after a visitor withdrew consent (window.gtag
	// survives the revoke) and only ever tracked gaIDs[0]. Here it fires only
	// while analytics consent stands, for every configured GA property.
	const pathname = usePathname();
	const analyticsGranted = Boolean(consent?.analytics);
	useEffect(() => {
		if (!IS_PROD || !analyticsGranted || !hasArrayValue(gaIDs)) return;
		for (const id of gaIDs) {
			gtag.pageview(pathname, id);
		}
	}, [pathname, analyticsGranted, gaIDs]);

	// Not production, or no decision yet → block all tracking. The banner prompts.
	if (!IS_PROD || !consent) {
		return null;
	}

	return (
		<>
			{consent.analytics && (
				<>
					{/* Inside the consent gate on purpose: a preconnect performs DNS +
					    TCP + TLS to Google, which discloses the visitor's IP before any
					    tag runs. Warming it unconditionally would contradict the gating
					    the rest of this component does. */}
					<link rel="preconnect" href="https://www.google-analytics.com" />
					{hasArrayValue(gaIDs) &&
						gaIDs.map((id) => <GoogleAnalytics key={id} gaId={id} />)}
					{hasArrayValue(gtmIDs) &&
						gtmIDs.map((id) => <GoogleTagManager key={id} gtmId={id} />)}
				</>
			)}
		</>
	);
}
