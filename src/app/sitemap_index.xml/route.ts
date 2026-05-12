const SITEMAPS = ['pages', 'events', 'curated'] as const;

export function GET() {
	const base = process.env.SITE_URL!;
	const now = new Date().toISOString();

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAPS.map(
	(id) => `  <sitemap>
    <loc>${base}/sitemap/${id}.xml</loc>
    <lastmod>${now}</lastmod>
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
