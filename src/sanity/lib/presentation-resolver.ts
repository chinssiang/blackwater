/**
 * Sets up the Presentation Resolver API,
 * see https://www.sanity.io/docs/presentation-resolver-api for more information.
 */
import { resolveHref } from '@/lib/routes';
import { LOCALES, type Locale, pickLocalizedValue } from '@/lib/i18n';
import { defineDocuments, defineLocations } from 'sanity/presentation';

type RouteEntry = { route: string; filter: string };

// Build locale-aware route entries for Presentation: one per locale for each route shape.
function withLocales(
	routeSuffix: string,
	typeFilter: string,
): RouteEntry[] {
	return LOCALES.map((locale) => {
		const langFilter = locale === 'en'
			? `(language == "en" || !defined(language))`
			: `language == "${locale}"`;
		const prefix = locale === 'en' ? '' : `/${locale}`;
		return {
			route: `${prefix}${routeSuffix}`,
			filter: `${typeFilter} && ${langFilter}`,
		};
	});
}

export const mainDocuments = defineDocuments([
	...withLocales('/', `_type == "pHome"`),
	...withLocales('/:slug', `_type == "pGeneral" && slug.current == $slug`),
	...withLocales('/blog', `_type == "pBlogIndex"`),
	...withLocales('/blog/:slug', `_type == "pBlog" && slug.current == $slug`),
	...withLocales('/contact', `_type == "pContact"`),
	...withLocales('/faq', `_type == "pFaq"`),
	...withLocales('/curated', `_type == "pCuratedIndex"`),
	...withLocales('/curated/products/:slug', `_type == "pCurated" && slug.current == $slug`),
	...withLocales('/curated/categories/:slug', `_type == "pCuratedCategory" && slug.current == $slug`),
	...withLocales('/curated/collections/:slug', `_type == "pCuratedCollection" && slug.current == $slug`),
]);

function locationsForAll(documentType: string, title: string, slug?: string | null) {
	return LOCALES.map((locale) => ({
		title: locale === 'en' ? title : `${title} (${locale})`,
		href: resolveHref({ documentType, slug, locale: locale as Locale }) || '',
	}));
}

export const locations = {
	pHome: defineLocations({
		message: 'This document is used to render the front page',
		tone: 'positive',
		locations: locationsForAll('pHome', 'Home'),
	}),
	settingsGeneral: defineLocations({
		message: 'This document is used on all pages',
		tone: 'positive',
	}),
	pGeneral: defineLocations({
		select: { name: 'name', slug: 'slug.current', language: 'language' },
		resolve: (doc) => ({
			locations: [
				{
					title: doc?.name || 'Untitled',
					href: resolveHref({
						documentType: 'pGeneral',
						slug: doc?.slug,
						locale: (doc?.language as Locale) ?? undefined,
					}) || '',
				},
			],
		}),
	}),
	pBlog: defineLocations({
		select: { title: 'title', slug: 'slug.current', language: 'language' },
		resolve: (doc) => ({
			locations: [
				{
					title: doc?.title || 'Untitled',
					href: resolveHref({
						documentType: 'pBlog',
						slug: doc?.slug,
						locale: (doc?.language as Locale) ?? undefined,
					}) || '',
				},
			],
		}),
	}),
	pFaq: defineLocations({
		message: 'This document is used to render the FAQ page',
		tone: 'positive',
		locations: locationsForAll('pFaq', 'FAQ'),
	}),
	gFaq: defineLocations({
		message: 'FAQ entries appear on the FAQ page and in FAQ modules',
		tone: 'caution',
		locations: locationsForAll('pFaq', 'FAQ'),
	}),
	pCuratedIndex: defineLocations({
		message: 'This document is used to render the curated picks page',
		tone: 'positive',
		locations: locationsForAll('pCuratedIndex', 'Curated'),
	}),
	pCurated: defineLocations({
		select: { title: 'title', slug: 'slug.current', language: 'language' },
		resolve: (doc) => ({
			locations: [
				{
					title: doc?.title || 'Untitled',
					href: resolveHref({
						documentType: 'pCurated',
						slug: doc?.slug,
						locale: (doc?.language as Locale) ?? undefined,
					}) || '',
				},
			],
		}),
	}),
	pCuratedCategory: defineLocations({
		// title is an internationalizedArrayString. Select it under a NON-reserved
		// key so Sanity's preview.select validator (which only checks reserved keys
		// title/subtitle/media) doesn't flag the raw array; unwrap it in resolve.
		select: { titleI18n: 'title', slug: 'slug.current' },
		resolve: (doc) => ({
			locations: [
				{
					title: pickLocalizedValue(doc?.titleI18n) || 'Untitled',
					href: resolveHref({
						documentType: 'pCuratedCategory',
						slug: doc?.slug,
					}) || '',
				},
			],
		}),
	}),
	pCuratedCollection: defineLocations({
		select: { title: 'title', slug: 'slug.current', language: 'language' },
		resolve: (doc) => ({
			locations: [
				{
					title: doc?.title || 'Untitled',
					href: resolveHref({
						documentType: 'pCuratedCollection',
						slug: doc?.slug,
						locale: (doc?.language as Locale) ?? undefined,
					}) || '',
				},
			],
		}),
	}),
};
