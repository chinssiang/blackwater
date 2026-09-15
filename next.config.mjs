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
		// The extensionless sitemap spellings, which are worse than a 404: neither
		// contains a dot, so src/proxy.ts prefixes the default locale and they
		// land on [...rest]'s deliberate soft-200 HTML — the condition Search
		// Console reports as "your sitemap appears to be an HTML page". (The
		// dotted /sitemap.xml behaves differently: the proxy matcher skips it, so
		// it reaches /[locale] and hard-404s on the invalid locale.)
		//
		// Redirects rather than rewrites, and that is load-bearing, not taste:
		// middleware runs BEFORE beforeFiles rewrites, so by the time a rewrite
		// source is matched the proxy has already rewritten these to /en/…, and a
		// `/sitemap` source no longer matches. Verified by moving both into
		// beforeFiles — each then answered 200 text/html, the exact bug above. So
		// /sitemap.xml is the only spelling a rewrite can serve; it lives in
		// rewrites() below and must not also appear here.
		return ['/sitemap', '/sitemap_index'].map((source) => ({
			source,
			destination: '/sitemap_index.xml',
			permanent: true,
		}));
	},
	// The ONLY rewrites() in this config — same duplicate-key hazard as
	// redirects() above.
	async rewrites() {
		// /sitemap.xml is the path crawlers probe first and the one people submit
		// to Search Console, and nothing SERVES it: generateSitemaps() puts
		// app/sitemap.ts's output at /sitemap/<id>.xml, and a route handler cannot
		// claim the path either, because Next reserves it for app/sitemap.ts and
		// fails the build with "Conflicting route and metadata". It is not
		// unrouted, though — /[locale] (^/([^/]+?)(?:/)?$) matches it and 404s on
		// the invalid locale — so a rewrite is the only way to answer it 200
		// application/xml. It is an alias: robots.ts still advertises
		// /sitemap_index.xml, which stays the canonical sitemap URL.
		//
		// It was a 308 here until 2026-09-15. Search Console reported "General
		// HTTP error, 302" against it — a status nothing in this repo can emit
		// (the entry was permanent: true, i.e. 308), so an apex→www or http→https
		// hop at the domain layer is the likelier cause, and that would recur
		// against /sitemap_index.xml. This rewrite is not a diagnosis; it removes
		// the redirect from the question so only the domain cause can remain.
		//
		// beforeFiles, because vercel.json declares its own rewrites and Vercel
		// emits those into the filesystem phase, which beforeFiles precedes —
		// afterFiles would lose to it. And /sitemap.xml must NOT also appear in
		// redirects(), which run first and would make this dead code with no build
		// error; src/lib/sitemaps.test.ts guards both halves.
		return {
			beforeFiles: [
				{ source: '/sitemap.xml', destination: '/sitemap_index.xml' },
			],
		};
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
