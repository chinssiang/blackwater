/**
 * Centralized route definitions — single source of truth for document type → URL resolution.
 * Drives both the JavaScript `resolveHref` helper and the GROQ query builder so
 * adding/changing a route only requires editing this file.
 */

import {
	DEFAULT_LOCALE,
	localizePath,
	stripLocaleFromHref,
	stripLocaleFromPathname,
	type Locale,
} from '@/lib/i18n';

export const DOCUMENT_ROUTES = [
	{ type: 'pHome', path: '/', slug: false },
	{ type: 'pGeneral', path: '/', slug: true },
	{ type: 'pProductIndex', path: '/products', slug: false },
	// Synthetic route (no backing document) — lets the paginated all-products
	// listing reuse resolveHref/defineMetadata for canonical + hreflang.
	{ type: 'pProductsAllIndex', path: '/products/all', slug: false },
	{ type: 'pProduct', path: '/products/', slug: true },
	// Synthetic route (no backing document) — lets the categories index page
	// reuse resolveHref/defineMetadata for canonical + hreflang.
	{
		type: 'pProductCategoriesIndex',
		path: '/products/categories',
		slug: false,
	},
	{ type: 'pProductCategory', path: '/products/categories/', slug: true },
	// Synthetic route (no backing document) — lets the collections index page
	// reuse resolveHref/defineMetadata for canonical + hreflang.
	{
		type: 'pProductCollectionsIndex',
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
];

// Reduces a locale-stripped path to the form route comparisons use: no query,
// no fragment, no trailing slash. An authored href may carry "?"/"#" that a
// pathname never does, so "/size-guide#tops" has to compare as "/size-guide"
// or a link is never active on the page it points at.
function toComparablePath(path: string): string {
	const trimmed = path.replace(/[?#].*$/, '').replace(/\/+$/, '');
	return trimmed === '' ? '/' : trimmed;
}

// The route predicates below all compare a usePathname() value, which the
// header re-derives for every menu item off one unchanging pathname. Cache the
// last answer: the function is pure, so a stale entry can only ever be the
// right answer for that same input.
let pathnameCache: { pathname: string; normalized: string } | undefined;

function normalizeRoutePath(pathname: string): string {
	if (pathnameCache?.pathname !== pathname) {
		pathnameCache = {
			pathname,
			normalized: toComparablePath(stripLocaleFromPathname(pathname).path),
		};
	}
	return pathnameCache.normalized;
}

// The href counterpart. Deliberately NOT normalizeRoutePath: a link target is
// authored, so a leading "/en/" is a real path segment (a pGeneral page slugged
// "en") and collapsing it would make the Home link active on that page while
// its own link never matched.
function normalizeHrefPath(href: string): string {
	return toComparablePath(stripLocaleFromHref(href).path);
}

const HIDE_GLOBAL_NEWSLETTER_PATHS = ['/events-crew', '/newsletter'];

export function shouldHideGlobalNewsletter(pathname: string): boolean {
	const normalized = normalizeRoutePath(pathname);
	return HIDE_GLOBAL_NEWSLETTER_PATHS.includes(normalized);
}

// Routes that render on the light theme; everything else is dark. Each entry
// matches itself and its descendants, so listing "/products" covers the whole
// product subtree. Read by both ThemeProvider (which sets the html class) and
// Layout (which flags the header) — keep it as the single predicate so the two
// can never disagree about whether a page is light.
const LIGHT_THEME_PATHS = ['/products', '/size-guide'];

export function isLightThemePath(pathname: string): boolean {
	const normalized = normalizeRoutePath(pathname);
	return LIGHT_THEME_PATHS.some(
		(base) => normalized === base || normalized.startsWith(`${base}/`)
	);
}

// Subtrees that carry the Taipei weather widget — each entry matches itself and
// its descendants, so "/events" covers the index and every single event. The
// homepage is handled separately below rather than listed here: as a base, "/"
// is a prefix of every path, so a subtree rule on it would show the widget
// sitewide.
const WEATHER_WIDGET_SUBTREES = ['/events'];

/**
 * Read by <Layout>, which mounts the widget in the always-mounted chrome.
 *
 * Goes through normalizeRoutePath for the reason the section on this file in
 * CLAUDE.md spells out: a prerender's pathname carries the internal "/en"
 * prefix that the client router never produces, so comparing a raw
 * usePathname() here would bake "hidden" into the prerendered HTML of every
 * English page and let hydration pop the widget in afterwards.
 */
export function shouldShowWeatherWidget(pathname: string): boolean {
	const normalized = normalizeRoutePath(pathname);
	if (normalized === '/') return true;
	return WEATHER_WIDGET_SUBTREES.some(
		(base) => normalized === base || normalized.startsWith(`${base}/`)
	);
}

export function resolveHref({
	documentType,
	slug,
	locale,
}: {
	documentType: string | null;
	slug?: string | null;
	locale?: Locale | null;
}) {
	if (!documentType) return undefined;

	const route = DOCUMENT_ROUTES.find((r) => r.type === documentType);

	// Fallback: any unknown type with a slug becomes "/<slug>"
	const path = !route
		? slug
			? `/${slug}`
			: undefined
		: route.slug
			? `${route.path}${slug}`
			: route.path;

	if (!path) return undefined;
	return localizePath(path, locale ?? DEFAULT_LOCALE);
}

// NOTE: This GROQ fragment must be kept in sync with DOCUMENT_ROUTES above.
//
// Why it is hand-written: Sanity's query extractor *substitutes syntax* rather
// than executing JS. Calls to arrow functions with a concise body do resolve
// (that is how locString/byLocale/i18nSharingFields in queries.ts work, and
// their expansions are visible in sanity.types.ts) — but `.map()`/`.join()`,
// block bodies, `+` concatenation and ternaries do not. Deriving this select()
// needs iteration, so it cannot be generated inside the literal.
//
// Uses $locale param (passed by every query that includes this via linkFields).
// For the default locale (en) the prefix is empty; for others it is "/<locale>".
export const resolvedHrefGroq = `select(
		linkType == "internal" => internalLink-> {
			"url": select(
				_type == "pHome" => select($locale == "en" => "/", "/" + $locale),
				select($locale == "en" => "", "/" + $locale) + select(
					_type == "pGeneral" => "/" + slug.current,
					_type == "pProductIndex" => "/products",
					_type == "pProduct" => "/products/" + slug.current,
					_type == "pProductCategory" => "/products/categories/" + slug.current,
					_type == "pProductCollection" => "/products/collections/" + slug.current,
					_type == "pEvents" => "/events",
					_type == "pEvent" => "/events/" + slug.current,
					_type == "pContact" => "/contact",
					_type == "pFaq" => "/faq",
					_type == "pSizeGuide" => "/size-guide",
					_type == "pNewsletter" => "/newsletter",
					defined(slug.current) => "/" + slug.current,
					null
				)
			)
		}.url,
		href
	)`;

/**
 * Checks if a link should be considered active based on the current path and target URL.
 * @param args - Object containing the current pathName and the target url.
 * @returns True if the link is active, otherwise false.
 */
export const checkIfLinkIsActive = ({
	pathName,
	url,
}: {
	pathName: string;
	url: string;
}): boolean => {
	if (!pathName || !url) return false;

	// One side is a pathname and the other an href, so they normalize
	// differently — see the two helpers above. Both shed the trailing slash, so
	// "/events/" from GROQ still matches "/events" from usePathname.
	const current = normalizeRoutePath(pathName);
	const target = normalizeHrefPath(url);

	// The home link is only active on the home page itself; otherwise every
	// route would match it as a descendant.
	if (target === '/') return current === '/';

	// Section/parent links stay active on descendant routes as well
	// (e.g. /products/foo keeps /products active).
	return current === target || current.startsWith(`${target}/`);
};
