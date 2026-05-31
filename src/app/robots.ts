// AI answer-engine crawlers we explicitly welcome so the site can be cited as a
// source in AI-generated responses (e.g. "running club in Taipei" / "台北跑團").
const AI_CRAWLERS = [
	'GPTBot',
	'OAI-SearchBot',
	'ChatGPT-User',
	'ClaudeBot',
	'Claude-Web',
	'PerplexityBot',
	'Google-Extended',
	'Applebot-Extended',
	'CCBot',
	'Bingbot',
];

const DISALLOW = ['/sanity/', '/api/'];

export default function robots() {
	return {
		rules: [
			{ userAgent: '*', allow: ['/'], disallow: DISALLOW },
			...AI_CRAWLERS.map((userAgent) => ({
				userAgent,
				allow: ['/'],
				disallow: DISALLOW,
			})),
		],
		sitemap: `${process.env.SITE_URL}/sitemap_index.xml`,
	};
}
