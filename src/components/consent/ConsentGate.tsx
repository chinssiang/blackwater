import { cookies } from 'next/headers';
import HeadTrackingCode from '@/components/layout/HeadTrackingCode';
import ConsentBanner, {
	type ConsentSettings,
} from '@/components/consent/ConsentBanner';
import { CONSENT_COOKIE, parseConsentCookie } from '@/lib/consent';
import type { Dictionary } from '@/lib/dictionary';

/**
 * The one place the consent cookie is read on the server.
 *
 * This used to live in `[locale]/layout.tsx`. Reading a Dynamic API in a *root*
 * layout opts the whole subtree out of static generation — measured: with the
 * read there, every `/[locale]/*` route built as `ƒ` (server-rendered on demand)
 * and shipped `cache-control: no-store`; with it moved down here behind a
 * <Suspense> boundary, they build as `●` (prerendered). That is the difference
 * between a CDN-cached site and re-running the product index's GROQ query plus
 * two Shopify Storefront calls on every single view.
 *
 * Both consumers stay server-rendered on purpose (see src/lib/consent.ts): the
 * Consent Mode v2 default script must execute during HTML parse, before the
 * deferred GA/GTM tags initialize, and the banner needs its initial state
 * without a hydration flash. Keeping them together in this one component also
 * preserves their relative order in the streamed HTML.
 */
export default async function ConsentGate({
	siteData,
	settings,
	fallback,
}: {
	siteData: unknown;
	settings: ConsentSettings;
	fallback: Dictionary['consent'];
}) {
	const cookieStore = await cookies();
	const consent = parseConsentCookie(cookieStore.get(CONSENT_COOKIE)?.value);

	return (
		<>
			<HeadTrackingCode siteData={siteData as never} consent={consent} />
			<ConsentBanner
				settings={settings}
				initialConsent={consent}
				fallback={fallback}
			/>
		</>
	);
}
