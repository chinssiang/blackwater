/**
 * Sets up the Presentation Resolver API,
 * see https://www.sanity.io/docs/presentation-resolver-api for more information.
 */
import { resolveHref } from '@/lib/routes';
import { LOCALES, type Locale, pickLocalizedValue } from '@/lib/i18n';
import { FIELD_LEVEL_I18N_TYPES } from '@/sanity/i18n-types';
import { defineDocuments, defineLocations } from 'sanity/presentation';

type RouteEntry = { route: string; filter: string };

// Build locale-aware route entries for Presentation: one per locale for each route shape.
//
// Types that carry every language in ONE document (the product family — see
// CLAUDE.md's Localization section) have no `language` field at all, so their
// per-locale filter must match on type alone; applying `language == "zh_tw"` to
// them resolves nothing and leaves visual editing dead on every zh route.
// Derived from FIELD_LEVEL_I18N_TYPES rather than flagged per call site, so a
// new field-level type can't be registered in the Studio's language filter and
// forgotten here.
function withLocales(
	routeSuffix: string,
	documentType: string,
	extraFilter?: string
): RouteEntry[] {
	const fieldLevel = (FIELD_LEVEL_I18N_TYPES as readonly string[]).includes(documentType);
	const typeFilter = extraFilter
		? `_type == "${documentType}" && ${extraFilter}`
		: `_type == "${documentType}"`;
	return LOCALES.map((locale) => {
		const langFilter = locale === 'en'
			? `(language == "en" || !defined(language))`
			: `language == "${locale}"`;
		const prefix = locale === 'en' ? '' : `/${locale}`;
		return {
			route: `${prefix}${routeSuffix}`,
			filter: fieldLevel ? typeFilter : `${typeFilter} && ${langFilter}`,
		};
	});
}

const BY_SLUG = `slug.current == $slug`;

export const mainDocuments = defineDocuments([
	...withLocales('/', 'pHome'),
	...withLocales('/:slug', 'pGeneral', BY_SLUG),
	...withLocales('/blog', 'pBlogIndex'),
	...withLocales('/blog/:slug', 'pBlog', BY_SLUG),
	...withLocales('/contact', 'pContact'),
	...withLocales('/faq', 'pFaq'),
	...withLocales('/size-guide', 'pSizeGuide'),
	...withLocales('/products', 'pProductIndex'),
	...withLocales('/products/:slug', 'pProduct', BY_SLUG),
	...withLocales('/products/categories/:slug', 'pProductCategory', BY_SLUG),
	...withLocales('/products/collections/:slug', 'pProductCollection', BY_SLUG),
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
	pSizeGuide: defineLocations({
		message: 'This document is used to render the size guide page',
		tone: 'positive',
		locations: locationsForAll('pSizeGuide', 'Size Guide'),
	}),
	gSizeChart: defineLocations({
		message: 'Size charts are listed on the size guide page',
		tone: 'caution',
		locations: locationsForAll('pSizeGuide', 'Size Guide'),
	}),
	pProductIndex: defineLocations({
		message: 'This document is used to render the products page',
		tone: 'positive',
		locations: locationsForAll('pProductIndex', 'Products'),
	}),
	pProduct: defineLocations({
		// Same treatment as pProductCategory below: title is an
		// internationalizedArrayString, selected under a non-reserved key and
		// unwrapped in resolve. One document now serves both locale routes, so it
		// offers a location for each rather than one derived from `language`.
		select: { titleI18n: 'title', slug: 'slug.current' },
		resolve: (doc) => ({
			locations: LOCALES.map((locale) => ({
				title: `${pickLocalizedValue(doc?.titleI18n) || 'Untitled'}${locale === 'en' ? '' : ` (${locale})`}`,
				href: resolveHref({
					documentType: 'pProduct',
					slug: doc?.slug,
					locale: locale as Locale,
				}) || '',
			})),
		}),
	}),
	pProductCategory: defineLocations({
		// title is an internationalizedArrayString. Select it under a NON-reserved
		// key so Sanity's preview.select validator (which only checks reserved keys
		// title/subtitle/media) doesn't flag the raw array; unwrap it in resolve.
		select: { titleI18n: 'title', slug: 'slug.current' },
		resolve: (doc) => ({
			locations: [
				{
					title: pickLocalizedValue(doc?.titleI18n) || 'Untitled',
					href: resolveHref({
						documentType: 'pProductCategory',
						slug: doc?.slug,
					}) || '',
				},
			],
		}),
	}),
	pProductCollection: defineLocations({
		select: { titleI18n: 'title', slug: 'slug.current' },
		resolve: (doc) => ({
			locations: LOCALES.map((locale) => ({
				title: `${pickLocalizedValue(doc?.titleI18n) || 'Untitled'}${locale === 'en' ? '' : ` (${locale})`}`,
				href: resolveHref({
					documentType: 'pProductCollection',
					slug: doc?.slug,
					locale: locale as Locale,
				}) || '',
			})),
		}),
	}),
};
