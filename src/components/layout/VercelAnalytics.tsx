'use client';

import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { useConsent } from '@/hooks/useConsent';

/**
 * Vercel Analytics + Speed Insights, behind the consent gate.
 *
 * These were previously rendered unconditionally from HtmlShell, so
 * va.vercel-scripts.com was contacted before the visitor had decided anything.
 * They are cookieless, which makes them lower-risk than GA — but the banner
 * claims to gate third-party requests, and a request that happens regardless of
 * the answer makes that claim untrue.
 *
 * Gated on `analytics` specifically (not merely "a decision exists"): both
 * products are measurement, which is what that category names. Consent is read
 * in the browser, so this renders nothing in prerendered HTML — the same
 * property that keeps every [locale] route static.
 */
export default function VercelAnalytics() {
	const consent = useConsent();

	if (!consent?.analytics) return null;

	return (
		<>
			<Analytics />
			<SpeedInsights />
		</>
	);
}
