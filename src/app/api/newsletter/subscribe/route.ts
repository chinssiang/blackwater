import { NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { client } from '@/sanity/lib/client';
import { newsletterConfigQuery } from '@/sanity/lib/queries';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

// The Klaviyo list is resolved server-side (from the locale's gNewsletter doc)
// so this endpoint can't be used to push signups onto an arbitrary list. The
// client supplies email + locale only.
const bodySchema = z.object({
	email: z.string().trim().email().max(320),
	// Where the form was rendered, for Klaviyo attribution. Constrained to a
	// literal union so it can't become an arbitrary label.
	placement: z.enum(['footer', 'page']).nullish(),
});

const CUSTOM_SOURCE: Record<'footer' | 'page', string> = {
	footer: 'Newsletter Footer',
	page: 'Newsletter Page',
};

// Best-effort per-IP throttle. In-memory, so it's per server instance — not
// airtight, but enough to stop naive scripted abuse of an endpoint that writes
// to Klaviyo.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const submissionTimes = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
	if (submissionTimes.size > 10_000) submissionTimes.clear();
	const now = Date.now();
	const recent = (submissionTimes.get(ip) ?? []).filter(
		(t) => now - t < RATE_WINDOW_MS
	);
	if (recent.length >= RATE_LIMIT) {
		submissionTimes.set(ip, recent);
		return true;
	}
	recent.push(now);
	submissionTimes.set(ip, recent);
	return false;
}

const KLAVIYO_REVISION = '2024-10-15';

export async function POST(req: NextRequest) {
	const ip =
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		req.headers.get('x-real-ip') ||
		'unknown';
	if (isRateLimited(ip)) {
		return NextResponse.json(
			{ ok: false, message: 'Too many requests. Try again later.' },
			{ status: 429 }
		);
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json(
			{ ok: false, message: 'Invalid request body.' },
			{ status: 400 }
		);
	}

	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ ok: false, message: 'Invalid email address.' },
			{ status: 400 }
		);
	}
	const { email, placement } = parsed.data;
	const rawLocale = (body as { locale?: unknown }).locale;
	const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

	const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
	if (!apiKey) {
		console.error('[newsletter] KLAVIYO_PRIVATE_API_KEY is not set');
		return NextResponse.json(
			{ ok: false, message: 'Server configuration error.' },
			{ status: 500 }
		);
	}

	// Read server-side (stega off) so the client can't override the list and a
	// draft-mode render can't leak stega characters into the id.
	let listId: string | null | undefined;
	try {
		const config = await client.fetch(
			newsletterConfigQuery,
			{ locale },
			{ stega: false }
		);
		// Hand-pasted id: a stray newline 404s every submission for this locale.
		listId = config?.listId?.trim();
	} catch (err) {
		console.error('[newsletter] failed to fetch config', err);
		return NextResponse.json(
			{ ok: false, message: 'Server configuration error.' },
			{ status: 500 }
		);
	}
	if (!listId) {
		console.error(
			'[newsletter] no gNewsletter.klaviyoListID for locale',
			locale
		);
		return NextResponse.json(
			{ ok: false, message: 'Newsletter signup is not configured.' },
			{ status: 500 }
		);
	}

	try {
		const res = await fetch(
			'https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/',
			{
				method: 'POST',
				headers: {
					Authorization: `Klaviyo-API-Key ${apiKey}`,
					revision: KLAVIYO_REVISION,
					'Content-Type': 'application/json',
					accept: 'application/json',
				},
				body: JSON.stringify({
					data: {
						type: 'profile-subscription-bulk-create-job',
						attributes: {
							custom_source: CUSTOM_SOURCE[placement ?? 'footer'],
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
			console.error(
				'[newsletter] Klaviyo error',
				res.status,
				locale,
				listId,
				body
			);
			return NextResponse.json(
				{ ok: false, message: 'Subscription failed.' },
				{ status: 502 }
			);
		}

		return Response.json({ ok: true });
	} catch (err) {
		console.error('[newsletter] fetch error', err);
		return NextResponse.json(
			{ ok: false, message: 'Subscription failed.' },
			{ status: 500 }
		);
	}
}
