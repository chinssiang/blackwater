import { NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { client } from '@/sanity/lib/client';
import { backInStockConfigQuery } from '@/sanity/lib/queries';
import { resolveHref } from '@/lib/routes';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

// The Klaviyo list is resolved server-side (from settings) and the product is
// only ever recorded as event properties — so this endpoint can't be used to
// push signups onto an arbitrary list. The client supplies email + product only.
const bodySchema = z.object({
	email: z.string().trim().email().max(320),
	productSlug: z.string().trim().min(1).max(200),
	productTitle: z.string().trim().min(1).max(300),
	// Variant identity, both optional: a product with a single default variant
	// has neither, and a combination Shopify never stocked has options but no
	// GID. Recorded so restock campaigns can segment on something sturdier than
	// a display title an editor can rename.
	variantGid: z.string().trim().max(200).nullish(),
	// Bounded like every sibling field: this is forwarded verbatim to Klaviyo
	// (as VariantOptions, and joined into VariantLabel), so an unbounded record
	// would let a scripted client pollute the metric with junk properties or
	// push the event past Klaviyo's payload limits. A real Shopify product has
	// at most a handful of options.
	variantOptions: z
		.record(z.string().max(50), z.string().max(100))
		.refine((v) => Object.keys(v).length <= 10, {
			message: 'Too many variant options.',
		})
		.nullish(),
});

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
			{ ok: false, message: 'Invalid submission.' },
			{ status: 400 }
		);
	}
	const { email, productSlug, productTitle, variantGid, variantOptions } =
		parsed.data;
	const rawLocale = (body as { locale?: unknown }).locale;
	const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

	const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
	if (!apiKey) {
		console.error('[back-in-stock] KLAVIYO_PRIVATE_API_KEY is not set');
		return NextResponse.json(
			{ ok: false, message: 'Server configuration error.' },
			{ status: 500 }
		);
	}

	// One global list for every back-in-stock signup, read server-side so the
	// client can't override it.
	let listId: string | null | undefined;
	try {
		const config = await client.fetch(
			backInStockConfigQuery,
			{},
			{ stega: false }
		);
		listId = config?.listId;
	} catch (err) {
		console.error('[back-in-stock] failed to fetch config', err);
		return NextResponse.json(
			{ ok: false, message: 'Server configuration error.' },
			{ status: 500 }
		);
	}
	if (!listId) {
		console.error('[back-in-stock] klaviyoBackInStockListId is not configured');
		return NextResponse.json(
			{ ok: false, message: 'Back-in-stock notifications are not configured.' },
			{ status: 500 }
		);
	}

	const klaviyoHeaders = {
		Authorization: `Klaviyo-API-Key ${apiKey}`,
		revision: KLAVIYO_REVISION,
		'Content-Type': 'application/json',
		accept: 'application/json',
	};

	// 1) Subscribe the profile to the single global back-in-stock list (consent).
	try {
		const res = await fetch(
			'https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/',
			{
				method: 'POST',
				headers: klaviyoHeaders,
				body: JSON.stringify({
					data: {
						type: 'profile-subscription-bulk-create-job',
						attributes: {
							custom_source: 'Back in Stock',
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
			const text = await res.text();
			console.error(
				'[back-in-stock] Klaviyo subscribe error',
				res.status,
				text
			);
			return NextResponse.json({ ok: false }, { status: 502 });
		}
	} catch (err) {
		console.error('[back-in-stock] subscribe fetch error', err);
		return NextResponse.json(
			{ ok: false, message: 'Subscription failed.' },
			{ status: 500 }
		);
	}

	// 2) Record which product was requested as a Klaviyo event, so restock
	// campaigns can segment by product. Best-effort: the subscription already
	// succeeded, so a failure here must not fail the request (a retry would
	// double-subscribe).
	try {
		const path = resolveHref({
			documentType: 'pProduct',
			slug: productSlug,
			locale,
		});
		const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';
		const productUrl = path ? `${siteUrl}${path}` : undefined;
		const res = await fetch('https://a.klaviyo.com/api/events/', {
			method: 'POST',
			headers: klaviyoHeaders,
			body: JSON.stringify({
				data: {
					type: 'event',
					attributes: {
						properties: {
							ProductName: productTitle,
							ProductSlug: productSlug,
							...(productUrl ? { ProductURL: productUrl } : {}),
							...(variantGid ? { VariantGID: variantGid } : {}),
							...(variantOptions && Object.keys(variantOptions).length > 0
								? {
										VariantOptions: variantOptions,
										// Flat string too: Klaviyo segment builders compare
										// scalars far more comfortably than nested objects.
										VariantLabel: Object.values(variantOptions).join(' / '),
										// A request for a combination that has no variant is a
										// demand signal for something never stocked, which is a
										// different campaign from "this sold out".
										VariantExists: Boolean(variantGid),
									}
								: {}),
						},
						metric: {
							data: {
								type: 'metric',
								attributes: { name: 'Requested Back in Stock' },
							},
						},
						profile: {
							data: { type: 'profile', attributes: { email } },
						},
					},
				},
			}),
		});
		if (!res.ok) {
			const text = await res.text();
			console.error('[back-in-stock] Klaviyo event error', res.status, text);
		}
	} catch (err) {
		console.error('[back-in-stock] event fetch error', err);
	}

	return Response.json({ ok: true });
}
