/**
 * The route table and the GROQ expression derived from it.
 *
 * A LEAF MODULE ON PURPOSE: it imports nothing. `scripts/generate-groq-constants.mjs`
 * loads it directly under `node --experimental-strip-types`, which runs real ESM
 * resolution — no tsconfig `paths`, no extensionless specifiers. Keeping this file
 * import-free is what lets the generator reach it without the app's own source
 * having to spell `./i18n.ts`, and without `allowImportingTsExtensions` being
 * opened project-wide for one build script's benefit.
 *
 * `src/lib/routes.ts` re-exports both of these; import from there, not here.
 */

export type RouteDefinition = {
	type: string;
	path: string;
	slug: boolean;
	/** Backs no document — see the note in the table. */
	synthetic?: boolean;
};

export const DOCUMENT_ROUTES = [
	{ type: 'pHome', path: '/', slug: false },
	{ type: 'pGeneral', path: '/', slug: true },
	{ type: 'pProductIndex', path: '/products', slug: false },
	// Synthetic route (no backing document) — lets the paginated all-products
	// listing reuse resolveHref/defineMetadata for canonical + hreflang.
	{
		type: 'pProductsAllIndex',
		path: '/products/all',
		slug: false,
		synthetic: true,
	},
	{ type: 'pProduct', path: '/products/', slug: true },
	// Synthetic route (no backing document) — lets the categories index page
	// reuse resolveHref/defineMetadata for canonical + hreflang.
	{
		type: 'pProductCategoriesIndex',
		synthetic: true,
		path: '/products/categories',
		slug: false,
	},
	{ type: 'pProductCategory', path: '/products/categories/', slug: true },
	// Synthetic route (no backing document) — lets the collections index page
	// reuse resolveHref/defineMetadata for canonical + hreflang.
	{
		type: 'pProductCollectionsIndex',
		synthetic: true,
		path: '/products/collections',
		slug: false,
	},
	{ type: 'pProductCollection', path: '/products/collections/', slug: true },
	{ type: 'pEvents', path: '/events', slug: false },
	{ type: 'pEvent', path: '/events/', slug: true },
	{ type: 'pContact', path: '/contact', slug: false },
	{ type: 'pFaq', path: '/faq', slug: false },
	{ type: 'pSizeGuide', path: '/size-guide', slug: false },
	{ type: 'pNewsletter', path: '/newsletter', slug: false },
	// { type: 'pBlogIndex', path: '/blog', slug: false },
	// { type: 'pBlog', path: '/blog/', slug: true },
] satisfies readonly RouteDefinition[];

/**
 * Build the GROQ `select()` that resolves an internal link to its href.
 *
 * Derived from DOCUMENT_ROUTES rather than written out, so a path change in the
 * table cannot silently leave the query emitting the old URL — which the old
 * hand-maintained literal allowed, since `routes.test.ts` only compared the set
 * of `_type` arms and never the paths.
 *
 * The result is materialised into `src/sanity/lib/groq-constants.generated.ts`
 * by `scripts/generate-groq-constants.mjs`, because Sanity's query extractor
 * substitutes syntax rather than executing JS: arrow calls with a concise body
 * resolve (that is how locString/byLocale work), but `.map()`/`.join()` do not.
 * Queries interpolate the generated constant; this function is the source.
 *
 * `$locale` is a GROQ parameter name, resolved at query time — it is a literal
 * in the emitted string, not an interpolation.
 *
 * Synthetic routes are excluded: they back no document, so no `internalLink->`
 * dereference can ever produce their `_type`.
 */
export function buildResolvedHrefGroq(
	locales: readonly string[],
	defaultLocale: string
): string {
	const arms = [
		...DOCUMENT_ROUTES.filter(
			(route) => !route.synthetic && route.type !== 'pHome'
		).map((route) =>
			route.slug
				? `_type == "${route.type}" => "${route.path}" + slug.current`
				: `_type == "${route.type}" => "${route.path}"`
		),
		'defined(slug.current) => "/" + slug.current',
		'null',
	].join(',\n\t\t\t\t\t');

	// Locale prefixes are emitted as LITERAL arms, one per locale, rather than as
	// `"/" + $locale`. groq-js types a parameter as `unknown`, and `+` propagates
	// that, so the concatenated form made TypeGen emit `href: unknown` for every
	// link in the app — which is why EventStatusPill, EventsBlock, HeroBlock and
	// CustomLink each had to re-narrow it with `typeof === 'string'`. Spelled out,
	// both sides of every `+` are strings and the whole select infers.
	//
	// `$locale` is a closed set, so the trailing default arm is unreachable in
	// practice; it exists because GROQ's select() needs a fallback.
	const prefixArms = locales
		.filter((locale) => locale !== defaultLocale)
		.map((locale) => `$locale == "${locale}" => "/${locale}"`);

	const localePrefix = `select(${[...prefixArms, '""'].join(', ')})`;
	const homeArm = `_type == "pHome" => select(${[
		...locales
			.filter((locale) => locale !== defaultLocale)
			.map((locale) => `$locale == "${locale}" => "/${locale}"`),
		'"/"',
	].join(', ')})`;

	return `select(
		linkType == "internal" => internalLink-> {
			"url": select(
				${homeArm},
				${localePrefix} + select(
					${arms}
				)
			)
		}.url,
		href
	)`;
}

