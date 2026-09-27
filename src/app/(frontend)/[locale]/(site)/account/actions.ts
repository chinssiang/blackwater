'use server';

import { client } from '@/sanity/lib/client';
import { newsletterConfigQuery } from '@/sanity/lib/queries';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';
import { subscribeToList, unsubscribeFromMarketing } from '@/lib/klaviyo';
import { getCurrentMember } from '@/lib/member/session';

/**
 * Settings -> Emails. A Server Action rather than a route, for Next's own
 * origin check on actions: this changes a member's marketing consent, so a
 * cross-site request must not be able to. The address is always the signed-in
 * member's own, read from the session, never from the caller.
 */
export async function setNewsletterSubscription(
	subscribed: boolean,
	pageLocale: string
): Promise<'ok' | 'signedOut' | 'failed'> {
	if (typeof subscribed !== 'boolean') return 'failed';
	const member = await getCurrentMember();
	if (member === null) return 'signedOut';
	if (member === 'unavailable') return 'failed';

	const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
	if (!apiKey) {
		console.error('[newsletter] KLAVIYO_PRIVATE_API_KEY is not set');
		return 'failed';
	}

	try {
		let res: Response;
		if (subscribed) {
			// The list for the language the member reads the club in, the way
			// the newsletter form picks it from the page it sits on.
			const locale = isLocale(member.preferredLocale)
				? member.preferredLocale
				: isLocale(pageLocale)
					? pageLocale
					: DEFAULT_LOCALE;
			const { listId } = await client.fetch(
				newsletterConfigQuery,
				{ locale },
				{ stega: false }
			);
			if (!listId) {
				console.error('[newsletter] no gNewsletter.klaviyoListID for', locale);
				return 'failed';
			}
			res = await subscribeToList({
				apiKey,
				email: member.email,
				listId,
				customSource: 'Member Account',
			});
		} else {
			res = await unsubscribeFromMarketing({ apiKey, email: member.email });
		}
		if (!res.ok) {
			console.error('[newsletter] Klaviyo error', res.status, await res.text());
			return 'failed';
		}
		return 'ok';
	} catch (err) {
		console.error('[newsletter] preference change failed', err);
		return 'failed';
	}
}
