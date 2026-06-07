/** @type {import('next').NextConfig} */

// NOTE: unsafe-inline is required for Next.js + GTM inline scripts.
// To harden further, implement nonce-based CSP via Next.js proxy.
const isDev = process.env.NODE_ENV === 'development';

const csp = [
	"default-src 'self'",
	// unsafe-eval is needed in dev for React/Turbopack debugging features (never used in prod)
	`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://va.vercel-scripts.com`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https://cdn.sanity.io https://www.google-analytics.com https://www.googletagmanager.com",
	"font-src 'self'",
	"connect-src 'self' https://*.sanity.io https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://va.vercel-scripts.com https://vitals.vercel-insights.com",
	"frame-src 'self' https://*.sanity.io",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
].join('; ');

// 301/308 redirects from the former /curated/* section to /products/*.
// The single-product route is collapsed: /curated/products/:slug -> /products/:slug,
// while the old all-products listing moves to /products/all.
// Listed most-specific first. Kept in sync with DOCUMENT_ROUTES in src/lib/routes.ts.
const productRedirectPaths = [
	['/curated/products/:slug', '/products/:slug'],
	['/curated/products', '/products/all'],
	['/curated/categories/:slug', '/products/categories/:slug'],
	['/curated/categories', '/products/categories'],
	['/curated/collections/:slug', '/products/collections/:slug'],
	['/curated/collections', '/products/collections'],
	['/curated', '/products'],
];

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
	images: {
		formats: ['image/avif', 'image/webp'],
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'cdn.sanity.io',
				pathname: `/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/**`,
			},
		],
	},
	async redirects() {
		return localePrefixes.flatMap((prefix) =>
			productRedirectPaths.map(([source, destination]) => ({
				source: `${prefix}${source}`,
				destination: `${prefix}${destination}`,
				permanent: true,
			}))
		);
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
