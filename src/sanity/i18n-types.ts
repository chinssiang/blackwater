export const TRANSLATABLE_TYPES = [
	'pHome',
	'pContact',
	'pFaq',
	'pNewsletter',
	'p404',
	'pProductIndex',
	'pGeneral',
	'pBlog',
	'pBlogIndex',
	'pBlogCategory',
	'pProduct',
	'pProductCollection',
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
