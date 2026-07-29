/**
 * Centralized route definitions — single source of truth for document type → URL resolution.
 * Drives both the JavaScript `resolveHref` helper and the GROQ query builder so
 * adding/changing a route only requires editing this file.
 */

import {
	DEFAULT_LOCALE,
	localizePath,
	stripLocaleFromPath,
	type Locale,
} from '@/lib/i18n';

export const DOCUMENT_ROUTES = [
	{ type: 'pHome', path: '/', slug: false },
	{ type: 'pGeneral', path: '/', slug: true },
	{ type: 'pProductIndex', path: '/products', slug: false },
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
	{ type: 'pEvents', path: '/events/', slug: false },
	{ type: 'pEvent', path: '/events/', slug: true },
	{ type: 'pContact', path: '/contact', slug: false },
	{ type: 'pFaq', path: '/faq', slug: false },
	{ type: 'pNewsletter', path: '/newsletter', slug: false },
	// { type: 'pBlogIndex', path: '/blog', slug: false },
	// { type: 'pBlog', path: '/blog/', slug: true },
];

const HIDE_GLOBAL_NEWSLETTER_PATHS = ['/events-crew', '/newsletter'];

export function shouldHideGlobalNewsletter(pathname: string): boolean {
	const { path } = stripLocaleFromPath(pathname);
	const normalized = path.replace(/\/+$/, '') || '/';
	return HIDE_GLOBAL_NEWSLETTER_PATHS.includes(normalized);
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

export function buildDocumentHrefGroq(slugField = 'slug.current') {
	const cases = DOCUMENT_ROUTES.map(({ type, path, slug }) =>
		slug
			? `_type == "${type}" => "${path}" + ${slugField}`
			: `_type == "${type}" => "${path}"`
	);

	cases.push(`defined(${slugField}) => "/" + ${slugField}`, 'null');

	return `select(${cases.join(',')})`;
}

// NOTE: This GROQ fragment must be kept in sync with DOCUMENT_ROUTES above.
// It cannot use buildDocumentHrefGroq() here because Sanity's static query
// extractor cannot evaluate function calls inside template literal interpolations.
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
					_type == "pEvents" => "/events/",
					_type == "pEvent" => "/events/" + slug.current,
					_type == "pContact" => "/contact",
					_type == "pFaq" => "/faq",
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
 * @param args - Object containing the current pathName, target url, and an optional flag for exact (child) matching.
 * @returns True if the link is active, otherwise false.
 */
export const checkIfLinkIsActive = ({
	pathName,
	url,
	isChild,
}: {
	pathName: string;
	url: string;
	isChild?: boolean;
}): boolean => {
	if (!pathName || !url) return false;

	// Strip the locale prefix and any trailing slash so comparisons are
	// consistent regardless of locale or how the href was authored
	// (e.g. "/events/" from GROQ vs "/events" from usePathname).
	const normalize = (value: string): string => {
		const { path } = stripLocaleFromPath(value);
		const trimmed = path.replace(/\/+$/, '');
		return trimmed === '' ? '/' : trimmed;
	};

	const current = normalize(pathName);
	const target = normalize(url);

	// The home link is only active on the home page itself; otherwise every
	// route would match it as a descendant.
	if (target === '/') return current === '/';

	// Child links match their own page exactly; section/parent links also stay
	// active on descendant routes (e.g. /products/foo keeps /products active).
	if (isChild) return current === target;
	return current === target || current.startsWith(`${target}/`);
};
