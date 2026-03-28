export default function robots() {
	return {
		rules: [
			{
				userAgent: '*',
				allow: ['/'],
				disallow: ['/sanity/', '/api/'],
			},
		],
		sitemap: `${process.env.SITE_URL}/sitemap.xml`,
	};
}
