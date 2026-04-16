/**
 * Centralized route definitions — single source of truth for document type → URL resolution.
 * Drives both the JavaScript `resolveHref` helper and the GROQ query builder so
 * adding/changing a route only requires editing this file.
 */

export const DOCUMENT_ROUTES = [
	{ type: 'pHome', path: '/', slug: false },
	{ type: 'pGeneral', path: '/', slug: true },
	{ type: 'pCuratedIndex', path: '/curated', slug: false },
	{ type: 'pCurated', path: '/curated/products/', slug: true },
	{ type: 'pCuratedCategory', path: '/curated/categories/', slug: true },
	{ type: 'pCuratedCollection', path: '/curated/collections/', slug: true },
	{ type: 'pEventIndex', path: '/events/', slug: false },
	{ type: 'pEvent', path: '/events/', slug: true },
	{ type: 'pContact', path: '/contact', slug: false },
	// { type: 'pBlogIndex', path: '/blog', slug: false },
	// { type: 'pBlog', path: '/blog/', slug: true },
];

export function resolveHref({
	documentType,
	slug,
}: {
	documentType: string | null;
	slug?: string | null;
}) {
	if (!documentType) return undefined;
	if (documentType === 'externalUrl') return slug;

	const route = DOCUMENT_ROUTES.find((r) => r.type === documentType);

	// Fallback: any unknown type with a slug becomes "/<slug>"
	if (!route) return slug ? `/${slug}` : undefined;

	return route.slug ? `${route.path}${slug}` : route.path;
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
export const resolvedHrefGroq = `"resolvedHref": select(
		linkType == "external" => externalUrl,
		linkType == "internal" => internalLink-> {
			"url": select(
				_type == "pHome" => "/",
				_type == "pGeneral" => "/" + slug.current,
				_type == "pCuratedIndex" => "/curated",
				_type == "pCurated" => "/curated/products/" + slug.current,
				_type == "pCuratedCategory" => "/curated/categories/" + slug.current,
				_type == "pCuratedCollection" => "/curated/collections/" + slug.current,
				_type == "pEventIndex" => "/events/",
				_type == "pEvent" => "/events/" + slug.current,
				_type == "pContact" => "/contact",
				defined(slug.current) => "/" + slug.current,
				null
			)
		}.url,
		''
	)`;

/**
 * Checks if a link should be considered active based on the current path and target URL.
 * @param args - Object containing the current pathName, target url, and an optional flag for child links.
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
	if (isChild) {
		// Compares the first segment of the pathName and url (e.g., /blog/post vs /blog)
		return (pathName.split('/')[1] || '') === (url.split('/')[1] || '');
	} else {
		return pathName === url;
	}
};
