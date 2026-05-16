import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/lib/utils';

export async function POST(req: NextRequest) {
	const body = await req.json();
	const { email, listId } = body as { email?: string; listId?: string };

	if (!email || !validateEmail(email)) {
		return NextResponse.json({ ok: false, message: 'Invalid email address.' }, { status: 400 });
	}

	if (!listId) {
		return NextResponse.json({ ok: false, message: 'Missing list ID.' }, { status: 400 });
	}

	const apiKey = process.env.KLAVIYO_API_KEY;
	if (!apiKey) {
		console.error('[newsletter] KLAVIYO_API_KEY is not set');
		return NextResponse.json({ ok: false, message: 'Server configuration error.' }, { status: 500 });
	}

	try {
		const res = await fetch(
			'https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/',
			{
				method: 'POST',
				headers: {
					Authorization: `Klaviyo-API-Key ${apiKey}`,
					revision: '2024-10-15',
					'Content-Type': 'application/json',
					accept: 'application/json',
				},
				body: JSON.stringify({
					data: {
						type: 'profile-subscription-bulk-create-job',
						attributes: {
							custom_source: 'Newsletter Footer',
							profiles: {
								data: [
									{
										type: 'profile',
										attributes: {
											email,
											subscriptions: {
												email: { marketing: { consent: 'SUBSCRIBED' } },
											},
										},
									},
								],
							},
						},
						relationships: {
							list: { data: { type: 'list', id: listId } },
						},
					},
				}),
			}
		);

		if (!res.ok) {
			const body = await res.text();
			console.error('[newsletter] Klaviyo error', res.status, body);
			return NextResponse.json({ ok: false }, { status: 502 });
		}

		return Response.json({ ok: true });
	} catch (err) {
		console.error('[newsletter] fetch error', err);
		return NextResponse.json({ ok: false, message: 'Subscription failed.' }, { status: 500 });
	}
}
