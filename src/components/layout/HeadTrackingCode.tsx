import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import { hasArrayValue } from '@/lib/utils';
import { toConsentModeSignals, type ConsentState } from '@/lib/consent';

// NOTE: no Klaviyo onsite script here. It was blocked outright by our own CSP
// (static.klaviyo.com is absent from script-src, and Klaviyo's endpoints from
// connect-src), so it only ever produced two console errors and did nothing.
// The flows that matter run server-side and are unaffected by CSP:
// /api/newsletter/subscribe and /api/products/back-in-stock both call
// a.klaviyo.com directly. `settingsIntegration.klaviyoCompanyId` stays in the
// schema; re-adding the script would mean widening script-src, connect-src,
// img-src and frame-src.
type Integrations = {
	gaIDs?: string[];
	gtmIDs?: string[];
};

type SiteData = {
	integrations?: Integrations;
};

type HeadTrackingCodeProps = {
	siteData?: SiteData;
	consent?: ConsentState | null;
};
export default function HeadTrackingCode({
	siteData,
	consent,
}: HeadTrackingCodeProps) {
	const { integrations } = siteData || {};
	const { gaIDs, gtmIDs } = integrations || {};

	if (process.env.NODE_ENV !== 'production') {
		return null;
	}

	// No decision yet → block all tracking. The banner will prompt.
	if (!consent) {
		return null;
	}

	const signals = toConsentModeSignals(consent);

	return (
		<>
			{/* Consent Mode v2 defaults. Rendered as a plain inline script in <head>
			    so it executes during HTML parse — before the deferred GA/GTM tags
			    initialize — and honors the visitor's stored decision. */}
			<script
				dangerouslySetInnerHTML={{
					__html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',${JSON.stringify(
						{ ...signals, wait_for_update: 500 }
					)});`,
				}}
			/>

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
