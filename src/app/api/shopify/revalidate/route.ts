/**
 * Revalidates the cached Shopify Storefront fetches when the store changes,
 * so admin edits (price, stock, variants) reach product pages within seconds
 * instead of waiting out the hourly backstop TTL.
 *
 * Set up in Shopify admin → Settings → Notifications → Webhooks:
 * 1. Create webhooks (format JSON, latest API version), all pointing at
 *    https://YOUR_SITE_URL/api/shopify/revalidate — one per event:
 *    - "Product update"          → refreshes that product's tag
 *    - "Product deletion"        → broad refresh (payload carries no handle)
 *    - "Inventory level update"  → broad refresh (ditto; drop this webhook if
 *      sales volume makes it too chatty — product updates still cover most
 *      availability flips, and the TTL bounds the rest)
 * 2. Copy the webhook signing secret shown at the bottom of that settings
 *    page into the SHOPIFY_WEBHOOK_SECRET env var (all admin-created webhooks
 *    on a shop share one signing secret).
 * 3. Add it to Vercel (`npx vercel env add SHOPIFY_WEBHOOK_SECRET`) and
 *    redeploy.
 *
 * "Product creation" is deliberately not registered: a new Shopify product
 * changes nothing here until an editor links it in Sanity.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isValidSignature(
	rawBody: string,
	header: string | null,
	secret: string
): boolean {
	if (!header) return false;
	const digest = createHmac('sha256', secret)
		.update(rawBody, 'utf8')
		.digest('base64');
	const a = Buffer.from(digest);
	const b = Buffer.from(header);
	return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
	const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
	if (!secret) {
		console.error('[shopify-revalidate] SHOPIFY_WEBHOOK_SECRET is not set');
		return new Response('Not configured', { status: 500 });
	}

	// Signature covers the raw bytes — read text first, parse after verifying.
	const rawBody = await req.text();
	if (
		!isValidSignature(
			rawBody,
			req.headers.get('x-shopify-hmac-sha256'),
			secret
		)
	) {
		console.error('[shopify-revalidate] invalid HMAC signature');
		return new Response('Invalid signature', { status: 401 });
	}

	const topic = req.headers.get('x-shopify-topic');
	if (!topic) {
		return new Response('Bad Request', { status: 400 });
	}

	let handle: string | null = null;
	if (topic === 'products/update' || topic === 'products/create') {
		try {
			const body = JSON.parse(rawBody) as { handle?: string };
			handle = body.handle ?? null;
		} catch {
			return new Response('Bad Request', { status: 400 });
		}
	}

	// Deletes and inventory changes carry no handle, so they fall through to
	// the broad tag every Shopify fetch is labeled with. Re-delivered webhooks
	// just revalidate again — idempotent.
	if (handle) {
		revalidateTag(`shopify:product:${handle}`, 'max');
	} else {
		revalidateTag('shopify', 'max');
	}

	return NextResponse.json({
		revalidated: true,
		topic,
		handle,
		now: Date.now(),
	});
}
