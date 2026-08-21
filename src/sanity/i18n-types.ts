export const TRANSLATABLE_TYPES = [
	'pHome',
	'pContact',
	'pFaq',
	'pSizeGuide',
	'pNewsletter',
	'p404',
	'pProductIndex',
	'pGeneral',
	'pBlog',
	'pBlogIndex',
	'pBlogCategory',
	// pProduct and pProductCollection are deliberately absent: the product
	// family is field-level localized (one document per product, prose in
	// internationalizedArrays — same model as pProductCategory and the same
	// reasoning as gSizeChart's locale-invariant measurements). A product's
	// commerce identity (Shopify handle, price, availability, images, refs)
	// exists once; only its copy varies by language.
	'settingsCart',
	// The event family (pEvent, pEvents, pEventCategory) is likewise absent: it
	// moved to field-level i18n for the same reason the products did, plus one
	// of its own. An event's identity is *an occurrence* — one date, one venue,
	// one crew roster — so two documents per event meant two copies of facts
	// that can only have one value, and they had already drifted apart (two
	// events carried different start times per language). One document makes
	// that class of bug unrepresentable.
	'gAnnouncement',
	'gFooter',
	'gHeader',
	'gNewsletter',
	'gFaq',
] as const;

export type TranslatableType = (typeof TRANSLATABLE_TYPES)[number];

/**
 * Routable document types localized at the FIELD level: one document carries
 * every language, with prose in `internationalizedArray`s. The counterpart to
 * TRANSLATABLE_TYPES above — no type belongs to both.
 *
 * NOT an inventory of everything using `internationalizedArray`: types with no
 * page of their own (gLocation, gSizeChart, gTag, pEventStatus, settingsGeneral)
 * carry i18n fields and are deliberately absent, because what this list drives —
 * the Studio language filter (sanity.config.ts) and the Presentation resolver's
 * per-locale routes — only applies to documents that render a page.
 *
 * Kept here so both are derived rather than hand-maintained: pProductCategory
 * was field-level from the start and was omitted from the filter, leaving its
 * editors facing every field twice.
 */
export const FIELD_LEVEL_I18N_TYPES = [
	'pProduct',
	'pProductCollection',
	'pProductCategory',
	'pEvent',
	'pEvents',
	'pEventCategory',
] as const;
