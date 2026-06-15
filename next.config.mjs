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
	allowedDevOrigins: ['192.168.0.109'],
	experimental: {
		// Enables React 19.2's <ViewTransition> for native page-navigation crossfades.
		viewTransition: true,
		// `viewTransition` alone does not switch Next to its experimental React build
		// (which is where the <ViewTransition> component actually lives in 16.2.x).
		// `taint` is the most behavior-neutral flag that flips Next to react-experimental
		// (it only exposes the taint APIs; no runtime/UI change). Required for the import above.
		taint: true,
	},
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
	// async redirects() {
	// 	return localePrefixes.flatMap((prefix) =>
	// 		[].map(([source, destination]) => ({
	// 			source: `${prefix}${source}`,
	// 			destination: `${prefix}${destination}`,
	// 			permanent: true,
	// 		}))
	// 	);
	// },
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
