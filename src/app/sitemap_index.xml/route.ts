import { SITEMAP_IDS } from '@/lib/sitemaps';

// The sitemap index. /sitemap.xml redirects here (see next.config.mjs) because
// app/sitemap.ts reserves that path for its generateSitemaps() output even
// though it answers only /sitemap/<id>.xml — a route handler there fails the
// build with "Conflicting route and metadata".
//
// Why the split survives at this size: the three sitemaps total a few hundred
// URLs, far under the 50,000-URL limit, so one flat sitemap at /sitemap.xml
// would work and would delete this file and the redirect. It is kept for the
// two things a single sitemap cannot give: per-section coverage reporting in
// Search Console, and per-section cache tags (SITEMAP_TAGS), which stop a tag
// edit from recomputing the events sitemap. Revisit if either stops earning it.
// No <lastmod> here, deliberately. It is optional in a sitemapindex, and the
// only value this route can produce cheaply is "now" — which claimed all three
// child sitemaps had just changed on every single regeneration, whether or not
// anything had. Google's documented response to lastmod it finds unreliable is
// to ignore lastmod for the whole site, which would quietly discard the
// per-page timestamps the child sitemaps work to get right. Omitting it costs
// nothing: crawlers read the children and use the accurate values there.
export function GET() {
	const base = process.env.SITE_URL!;

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_IDS.map(
	(id) => `  <sitemap>
    <loc>${base}/sitemap/${id}.xml</loc>
  </sitemap>`
).join('\n')}
</sitemapindex>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
		},
	});
}
