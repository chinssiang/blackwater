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
	'pEvent',
	'pEvents',
	'pEventCategory',
	'gAnnouncement',
	'gFooter',
	'gHeader',
	'gNewsletter',
	'gFaq',
] as const;

export type TranslatableType = (typeof TRANSLATABLE_TYPES)[number];

/**
 * Types localized at the FIELD level: one document carries every language, with
 * prose in `internationalizedArray`s. The counterpart to TRANSLATABLE_TYPES
 * above — a type belongs to exactly one of these two lists.
 *
 * Kept here so the Studio's language filter (sanity.config.ts) is derived
 * rather than hand-maintained: pProductCategory was field-level from the start
 * and was omitted from that filter, leaving its editors facing every field
 * twice.
 */
export const FIELD_LEVEL_I18N_TYPES = [
	'pProduct',
	'pProductCollection',
	'pProductCategory',
] as const;
