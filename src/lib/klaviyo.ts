import 'server-only';

// Klaviyo's REST API, server-side only: the private key can read and change
// any profile. Env is read at call time, so a deployment without it builds.

const REVISION = '2024-10-15';

function klaviyoFetch(path: string, apiKey: string, init: RequestInit = {}) {
	return fetch(`https://a.klaviyo.com/api/${path}`, {
		...init,
		headers: {
			Authorization: `Klaviyo-API-Key ${apiKey}`,
			revision: REVISION,
			'Content-Type': 'application/json',
			accept: 'application/json',
		},
		cache: 'no-store',
	});
}

const marketing = (consent: 'SUBSCRIBED' | 'UNSUBSCRIBED') => ({
	email: { marketing: { consent } },
});

/** Subscribes `email` to email marketing and adds it to `listId`. Returns
 *  Klaviyo's response for the caller to judge. */
export function subscribeToList({
	apiKey,
	email,
	listId,
	customSource,
}: {
	apiKey: string;
	email: string;
	listId: string;
	customSource: string;
}) {
	return klaviyoFetch('profile-subscription-bulk-create-jobs/', apiKey, {
		method: 'POST',
		body: JSON.stringify({
			data: {
				type: 'profile-subscription-bulk-create-job',
				attributes: {
					custom_source: customSource,
					profiles: {
						data: [
							{
								type: 'profile',
								attributes: { email, subscriptions: marketing('SUBSCRIBED') },
							},
						],
					},
				},
				relationships: { list: { data: { type: 'list', id: listId } } },
			},
		}),
	});
}

/** Unsubscribes `email` from ALL email marketing. Deliberately not per list:
 *  consent is one fact per profile in Klaviyo, so leaving one list while
 *  staying subscribed would keep the newsletter coming from the other. */
export function unsubscribeFromMarketing({
	apiKey,
	email,
}: {
	apiKey: string;
	email: string;
}) {
	return klaviyoFetch('profile-subscription-bulk-delete-jobs/', apiKey, {
		method: 'POST',
		body: JSON.stringify({
			data: {
				type: 'profile-subscription-bulk-delete-job',
				attributes: {
					profiles: {
						data: [
							{
								type: 'profile',
								attributes: { email, subscriptions: marketing('UNSUBSCRIBED') },
							},
						],
					},
				},
			},
		}),
	});
}

/**
 * Whether Klaviyo will send `email` marketing: `true`/`false`, or `null` when
 * that cannot be known right now (no key, or the read failed). A profile
 * Klaviyo has never seen is `false`.
 */
export async function canReceiveEmailMarketing(
	email: string
): Promise<boolean | null> {
	const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
	if (!apiKey) return null;
	const filter = encodeURIComponent(`equals(email,${JSON.stringify(email)})`);
	try {
		const res = await klaviyoFetch(
			`profiles/?filter=${filter}&additional-fields[profile]=subscriptions`,
			apiKey,
			{ signal: AbortSignal.timeout(5000) }
		);
		if (!res.ok) {
			console.error('[klaviyo] profile read failed', res.status);
			return null;
		}
		const body = (await res.json()) as {
			data?: {
				attributes?: {
					subscriptions?: {
						email?: {
							marketing?: {
								can_receive_email_marketing?: boolean;
							};
						};
					};
				};
			}[];
		};
		return (
			body.data?.[0]?.attributes?.subscriptions?.email?.marketing
				?.can_receive_email_marketing ?? false
		);
	} catch (err) {
		console.error('[klaviyo] profile read failed', err);
		return null;
	}
}
