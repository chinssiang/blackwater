import { at, defineMigration, set } from 'sanity/migrate';

/*
	Backfills `language: "en"` on all existing documents of the translatable types
	that have no language field set. Required for @sanity/document-internationalization
	to recognise them as the base English version and correctly link future translations.

	Run:
	  npx sanity migration run i18n-set-default-language --dry-run
	  npx sanity migration run i18n-set-default-language --no-dry-run
*/

const TRANSLATABLE_TYPES = new Set([
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
]);

export default defineMigration({
	title: 'Set language="en" on existing translatable documents',
	migrate: {
		document(doc) {
			if (!TRANSLATABLE_TYPES.has(doc._type)) return;
			if (doc.language) return;
			return [at('language', set('en'))];
		},
	},
});
