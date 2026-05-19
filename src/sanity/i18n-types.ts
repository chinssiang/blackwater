export const TRANSLATABLE_TYPES = [
	'pHome',
	'pContact',
	'p404',
	'pCuratedIndex',
	'pGeneral',
	'pBlog',
	'pBlogIndex',
	'pBlogCategory',
	'pCurated',
	'pCuratedCategory',
	'pCuratedCollection',
	'pEvent',
	'pEvents',
	'pEventCategory',
	'gAnnouncement',
	'gFooter',
	'gHeader',
] as const;

export type TranslatableType = (typeof TRANSLATABLE_TYPES)[number];
