/**
 * Centralized route definitions — single source of truth for document type → URL resolution.
 * Drives both the JavaScript `resolveHref` helper and the GROQ query builder so
 * adding/changing a route only requires editing this file.
 */

import {
	DOCUMENT_ROUTES,
	buildResolvedHrefGroq as buildGroq,
	type RouteDefinition,
} from '@/lib/document-routes';
import {
	DEFAULT_LOCALE,
	LOCALES,
	localizePath,
	stripLocaleFromHref,
	stripLocaleFromPathname,
	type Locale,
} from '@/lib/i18n';

// Re-exported so callers keep one import site. The table and the GROQ builder
// live in the import-free leaf beside this file; see the note there.
export { DOCUMENT_ROUTES, type RouteDefinition };

/** The GROQ href expression, with this app's default locale bound in. */
export const buildResolvedHrefGroq = () => buildGroq(LOCALES, DEFAULT_LOCALE);


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
