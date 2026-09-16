/**
 * Lets `src/lib/sitemaps.test.ts` import `next.config.mjs` with `allowJs` off.
 * Not `NextConfig`: `rewrites`/`redirects` are optional there and `rewrites()`
 * may return a bare array.
 */
declare const nextConfig: {
	rewrites: () => Promise<{
		beforeFiles: Array<{ source: string; destination: string }>;
	}>;
	redirects: () => Promise<Array<{ source: string }>>;
};

export default nextConfig;
