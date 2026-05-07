/** @type {import('next').NextConfig} */

// NOTE: unsafe-inline is required for Next.js + GTM inline scripts.
// To harden further, implement nonce-based CSP via Next.js middleware.
const csp = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://va.vercel-scripts.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https://cdn.sanity.io https://www.google-analytics.com https://www.googletagmanager.com",
	"font-src 'self'",
	"connect-src 'self' https://*.sanity.io https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://va.vercel-scripts.com https://vitals.vercel-insights.com",
	"frame-src 'self' https://*.sanity.io",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
].join('; ');

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
