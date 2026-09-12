import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */

// NOTE: unsafe-inline is required for Next.js + GTM inline scripts.
// To harden further, implement nonce-based CSP via Next.js proxy.
const isDev = process.env.NODE_ENV === 'development';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const csp = [
	"default-src 'self'",
	// unsafe-eval is needed in dev for React/Turbopack debugging features (never used in prod)
	`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://va.vercel-scripts.com`,
	"style-src 'self' 'unsafe-inline'",
	// cdn.shopify.com serves the product page's image gallery and the cart
	// drawer's line-item thumbnails.
	"img-src 'self' data: blob: https://cdn.sanity.io https://cdn.shopify.com https://www.google-analytics.com https://www.googletagmanager.com",
	"font-src 'self'",
	"connect-src 'self' https://*.sanity.io https://*.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://va.vercel-scripts.com https://vitals.vercel-insights.com",
	"frame-src 'self' https://*.sanity.io",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
].join('; ');

// Locale prefixes: '' (default en, unprefixed) and '/zh_tw'. Keep in sync with src/lib/i18n.ts.
const localePrefixes = ['', '/zh_tw'];

const securityHeaders = [
	{ key: 'X-Frame-Options', value: 'SAMEORIGIN' },
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	{
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=()',
	},
	{
		key: 'Strict-Transport-Security',
		value: 'max-age=63072000; includeSubDomains; preload',
	},
	{ key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
	// Pin the workspace root to this checkout. Without it, Next infers the root
	// from the outermost lockfile, and builds inside a git worktree resolve
	// modules (e.g. sanity.types) against the parent checkout's stale files.
	turbopack: {
		root: projectRoot,
	},
	allowedDevOrigins: ['192.168.0.109'],
	// NOTE on prerendering: every /[locale]/* route builds as `●` (prerendered)
	// because nothing in that subtree reads a Dynamic API — the consent decision
	// comes from the browser (src/hooks/useConsent.ts). Keep it that way: a
	// server-side cookie read cannot be rescued by wrapping it in <Suspense>,
	// which was tried. Making a boundary enough would need
	// `cacheComponents: true`, tried and reverted: it requires every uncached
	// read to be inside <Suspense> (it failed at the root of the tree), and the
	// alternative — moving Sanity reads into `'use cache'` — is blocked because
	// next-sanity's `sanityFetch` (defineLive) calls `draftMode()` internally,
	// and Dynamic APIs are illegal inside `use cache`.
	experimental: {
		// NOTE: `viewTransition` + `taint` were removed deliberately. `viewTransition`
		// makes React emit `<link rel="expect" href="#_R_" blocking="render">`, which
		// forbids the browser from painting until the element carrying `id="_R_"` has
		// parsed — on /products that sat 63% into a 532KB document, costing ~12.5s of
		// LCP "element render delay". `taint` existed only to flip Next onto its
		// react-dom-experimental build so `<ViewTransition>` would resolve. Nothing in
		// src/ ever rendered `<ViewTransition>`, so both flags were pure cost. The
		// page-navigation crossfade is CSS (`.animate-page-in` in globals.css, replayed
		// by `key={pathname}` on <Main>) and does not need either flag.
		//
		// `motion/react` is an umbrella barrel pulling far more into a chunk than
		// the few exports actually used. Base UI needs no entry: every import is a
		// per-component subpath (`@base-ui/react/dialog`), which is already the
		// granularity this option manufactures.
		//
		// Entries are matched against the import specifier, so this must be the
		// exact string the source imports from: `motion/react` (11 files). Plain
		// `motion` matches nothing here — no file imports it — and silently
		// optimizes nothing.
		optimizePackageImports: ['motion/react'],
	},
	images: {
		formats: ['image/avif', 'image/webp'],
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'cdn.sanity.io',
				pathname: `/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/**`,
			},
			// Shopify product and variant images: the product page gallery and the
			// cart's line-item thumbnails. Both go through the image optimizer, so a
			// Shopify URL outside this pathname prefix answers 400 and that one
			// image breaks — widen the pattern rather than bypassing next/image.
			{
				protocol: 'https',
				hostname: 'cdn.shopify.com',
				pathname: '/s/files/**',
			},
		],
	},
	// The ONLY redirects() in this config — keep it that way. A second one is a
	// duplicate object key: the later definition silently wins and the other's
	// redirects vanish with a green build. Content redirects belong in the array
	// below, per locale prefix:
	//
	// 	...localePrefixes.flatMap((prefix) =>
	// 		[['/old', '/new']].map(([source, destination]) => ({
	// 			source: `${prefix}${source}`,
	// 			destination: `${prefix}${destination}`,
	// 			permanent: true,
	// 		}))
	// 	),
	async redirects() {
		// Nothing answers /sitemap.xml — the location crawlers try first and the
		// one most people submit to Search Console. app/sitemap.ts uses
		// generateSitemaps(), so its output lives at /sitemap/<id>.xml while the
		// bare path stays unrouted, and unrouted paths fall through to the
		// [locale] catch-all, which renders the 404 page. Search Console read that
		// as "your sitemap appears to be an HTML page".
		//
		// A route handler at app/sitemap.xml/route.ts cannot fix it: Next still
		// reserves /sitemap.xml for app/sitemap.ts and fails the build with
		// "Conflicting route and metadata". Redirect instead — crawlers follow
		// redirects on sitemap URLs.
		//
		// The extensionless spellings are here because they are worse than a 404:
		// the catch-all answers them 200 with HTML, which is exactly the condition
		// that produces the Search Console error, so a mistyped submission stays
		// broken silently. This covers the sitemap paths only; the catch-all's
		// soft-200 on every other unmatched path is a separate, deliberate
		// trade-off documented in CLAUDE.md.
		return ['/sitemap.xml', '/sitemap', '/sitemap_index'].map((source) => ({
			source,
			destination: '/sitemap_index.xml',
			permanent: true,
		}));
	},
	async headers() {
		return [
			{
				source: '/sanity/:path*',
				headers: [
					{ key: 'X-Frame-Options', value: 'SAMEORIGIN' },
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
				],
			},
			{
				source: '/((?!sanity).*)',
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
