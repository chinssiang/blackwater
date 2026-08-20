'use client';

import { useEffect } from 'react';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import Script from 'next/script';
import { hasArrayValue } from '@/lib/utils';
import { pushConsentDefault, pushConsentUpdate } from '@/lib/consent';
import { useConsent } from '@/hooks/useConsent';

const IS_PROD = process.env.NODE_ENV === 'production';

// Exported so HtmlShell can narrow siteData down to this before crossing the
// server/client boundary: everything passed to a client component is serialized
// into the RSC payload, and the tags need three ids, not the whole site blob.
export type TrackingIntegrations = {
	gaIDs?: string[];
	gtmIDs?: string[];
	klaviyoCompanyId?: string;
};

type HeadTrackingCodeProps = {
	integrations?: TrackingIntegrations;
};
export default function HeadTrackingCode({
	integrations,
}: HeadTrackingCodeProps) {
	const { gaIDs, gtmIDs, klaviyoCompanyId } = integrations || {};

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

	// Not production, or no decision yet → block all tracking. The banner prompts.
	if (!IS_PROD || !consent) {
		return null;
	}

	return (
		<>
			{consent.analytics && (
				<>
					{hasArrayValue(gaIDs) &&
						gaIDs.map((id) => <GoogleAnalytics key={id} gaId={id} />)}
					{hasArrayValue(gtmIDs) &&
						gtmIDs.map((id) => <GoogleTagManager key={id} gtmId={id} />)}
				</>
			)}

			{consent.marketing && klaviyoCompanyId && (
				<>
					<Script
						id="klaviyo-onsite"
						strategy="afterInteractive"
						src={`https://static.klaviyo.com/onsite/js/${klaviyoCompanyId}/klaviyo.js?company_id=${klaviyoCompanyId}`}
					/>
					<Script id="klaviyo-init" strategy="afterInteractive">
						{`!function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();`}
					</Script>
				</>
			)}
		</>
	);
}
