import { NextResponse, type NextRequest } from 'next/server';

/**
 * Same-origin passthrough for the Sanity-hosted favicon.
 *
 * Why not `/_next/image`: the optimizer content-negotiates on `Accept`, and its
 * fallback for a client that advertises neither AVIF nor WebP is **JPEG**
 * (measured: `Accept: image/png` returns `image/jpeg`). JPEG has no alpha, so a
 * transparent PNG favicon comes back with a solid background. Favicons are also
 * fetched by clients that ignore `Accept` semantics entirely.
 *
 * Why not a raw cdn.sanity.io URL in `icons.icon`: favicons are requested with
 * credentials, so the browser attaches the `sanitySession` cookie to a
 * third-party host.
 *
 * This streams the original bytes and content-type unchanged, from our origin.
 */

const ALLOWED_HOST = 'cdn.sanity.io';
const ALLOWED_PREFIX = `/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/`;

export async function GET(request: NextRequest) {
	const target = request.nextUrl.searchParams.get('url');
	if (!target) {
		return new NextResponse('Missing url', { status: 400 });
	}

	// Closed allowlist, mirroring images.remotePatterns in next.config.mjs — this
	// must never become a general-purpose proxy.
	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		return new NextResponse('Invalid url', { status: 400 });
	}
	if (
		parsed.protocol !== 'https:' ||
		parsed.hostname !== ALLOWED_HOST ||
		!parsed.pathname.startsWith(ALLOWED_PREFIX)
	) {
		return new NextResponse('Forbidden url', { status: 400 });
	}

	const upstream = await fetch(parsed.toString(), {
		// Sanity assets are content-addressed, so the URL changes when the image
		// does; cache indefinitely.
		next: { revalidate: false },
	});
	if (!upstream.ok || !upstream.body) {
		return new NextResponse('Upstream error', { status: 502 });
	}

	return new NextResponse(upstream.body, {
		headers: {
			'Content-Type':
				upstream.headers.get('content-type') ?? 'application/octet-stream',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
}
