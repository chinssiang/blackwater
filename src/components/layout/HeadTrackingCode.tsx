import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import Script from 'next/script';
import { hasArrayValue } from '@/lib/utils';
import { toConsentModeSignals, type ConsentState } from '@/lib/consent';

type Integrations = {
	gaIDs?: string[];
	gtmIDs?: string[];
	klaviyoCompanyId?: string;
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
	const { gaIDs, gtmIDs, klaviyoCompanyId } = integrations || {};

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
