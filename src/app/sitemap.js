import { defineQuery } from 'next-sanity';
import { sanityFetch } from '@/sanity/lib/live';
import {
	pageBlogSlugsQuery,
	pageGeneralSlugsQuery,
} from '@/sanity/lib/queries';
import fs from 'fs';
import { formatUrl } from '@/lib/utils';
import path from 'path';

const ROUTES = [
	{
		type: 'pGeneral',
		slug: '',
		changeFrequency: 'weekly',
		priority: 0.8,
	},
	{
		type: 'pBlog',
		slug: 'blog',
		changeFrequency: 'weekly',
		priority: 0.8,
	},
	// {
	// 	type: 'pBlogCategory',
	// 	slug: 'blog/category',
	// 	changeFrequency: 'monthly',
	// 	priority: 0.7,
	// 	skipParentPath: true,
	// },
	// {
	// 	type: 'gAuthor',
	// 	slug: 'blog/author',
	// 	changeFrequency: 'monthly',
	// 	priority: 0.7,
	// 	skipParentPath: true,
	// },
];

const EXCLUDED_DIRS = [
	'_components',
	'[...not_found]',
	'[slug]',
	'api',
	'_tests',
	'email-signature',
];

async function getPagesPaths(pageType) {
	const getQuery = (pageType) => {
		switch (pageType) {
			case 'pGeneral':
				return pageGeneralSlugsQuery;
			case 'pBlog':
				return pageBlogSlugsQuery;
			default:
				console.warn('Invalid Page Type:', pageType);
				return pageGeneralSlugsQuery;
		}
	};

	const query = getQuery(pageType);

	return sanityFetch({
		query,
		perspective: 'published',
		stega: false,
	});
}

async function getDocumentData(type, slug) {
	try {
		const query =
			defineQuery(`*[${type ? `_type == "${type}" &&` : ''} slug.current == "${slug}"][0] {
      _updatedAt,
      "disableIndex": sharing.disableIndex
    }`);
		const doc = await sanityFetch({ query });
		return {
			lastModified: doc?._updatedAt || new Date().toISOString(),
			disableIndex: doc?.disableIndex || false,
		};
	} catch (error) {
		console.error(`Error fetching document data: ${error.message}`);
		return { lastModified: new Date().toISOString(), disableIndex: false };
	}
}

async function getStaticRoutes(baseUrl) {
	const fullPath = path.join(process.cwd(), 'src/app/(frontend)');
	const routes = [];

	// Add homepage
	routes.push({
		url: formatUrl(baseUrl),
		lastModified: new Date().toISOString(),
		changeFrequency: 'weekly',
		priority: 1.0,
	});

	async function traverse(dir) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory() && !EXCLUDED_DIRS.includes(entry.name)) {
				const fullEntryPath = path.join(dir, entry.name);
				const relativePath = path.relative(fullPath, fullEntryPath);
				const url = new URL(`${baseUrl}/${relativePath}`).toString();
				const lastPath = relativePath.split('/').pop();

				// Check if this path matches any routes with skipParentPath
				const matchingRoute = ROUTES.find((route) => {
					const routePath = route.slug.split('/').filter(Boolean);
					const currentPath = relativePath.split('/').filter(Boolean);
					return (
						routePath.length === currentPath.length &&
						routePath.every(
							(segment, index) => segment === currentPath[index]
						) &&
						route.skipParentPath
					);
				});

				// Skip if this is a parent path that should be skipped
				if (matchingRoute) {
					continue;
				}

				const { lastModified, disableIndex } = await getDocumentData(
					null,
					lastPath
				);

				if (!disableIndex) {
					routes.push({
						url: formatUrl(url),
						lastModified,
						changeFrequency: 'weekly',
						priority: 1.0,
					});
				}

				await traverse(fullEntryPath);
			}
		}
	}

	await traverse(fullPath);
	return routes;
}

async function getDynamicRoutes(baseUrl) {
	try {
		const routes = await Promise.all(
			ROUTES.map(
				async ({ type, slug, changeFrequency, priority, skipParentPath }) => {
					const { data: slugs } = await getPagesPaths(type);
					const urlPrefix = slug ? `/${slug}` : '';

					const pageRoutes = await Promise.all(
						slugs.map(async ({ slug: pageSlug }) => {
							// Skip if this is a parent path and skipParentPath is true
							if (skipParentPath && !pageSlug) return null;

							const url = new URL(
								`${baseUrl}${urlPrefix}${pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`}`
							).toString();

							const { lastModified, disableIndex } = await getDocumentData(
								type,
								pageSlug
							);

							if (disableIndex) return null;

							return {
								url: formatUrl(url),
								lastModified,
								changeFrequency,
								priority,
							};
						})
					);

					return pageRoutes.filter(Boolean);
				}
			)
		);

		return routes.flat();
	} catch (error) {
		console.error('Error generating dynamic routes:', error);
		return [];
	}
}

export default async function generateSitemap() {
	const baseUrl = process.env.SITE_URL?.replace(/\/$/, '');
	if (!baseUrl) throw new Error('SITE_URL environment variable is required');

	const [staticRoutes, dynamicRoutes] = await Promise.all([
		getStaticRoutes(baseUrl),
		getDynamicRoutes(baseUrl),
	]);

	return [...staticRoutes, ...dynamicRoutes];
}
