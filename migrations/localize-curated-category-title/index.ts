import { at, defineMigration, set, unset } from 'sanity/migrate';
import type { NodePatch } from 'sanity/migrate';

/*
	Converts pCuratedCategory.title from a plain string into an
	internationalizedArrayString (inline i18n), and drops the now-orphaned
	document-level `language` field.

	Item shape matches this project's convention (queries filter on `language ==`):
	  { _key: 'en', _type: 'internationalizedArrayStringValue', language: 'en', value }

	Run order:
	  1. Deploy the schema change (title is internationalizedArrayString;
	     pCuratedCategory removed from TRANSLATABLE_TYPES).
	  2. npx sanity migration run localize-curated-category-title --no-dry-run
	  3. Optionally validate: npx sanity documents validate
*/

export default defineMigration({
	title: 'Localize pCuratedCategory title + drop doc-level language',
	documentTypes: ['pCuratedCategory'],
	migrate: {
		document(doc): NodePatch[] | undefined {
			const patches: NodePatch[] = [];
			if (typeof doc.title === 'string') {
				patches.push(
					at(
						'title',
						set([
							{
								_key: 'en',
								_type: 'internationalizedArrayStringValue',
								language: 'en',
								value: doc.title,
							},
						])
					)
				);
			}
			if (doc.language !== undefined) {
				patches.push(at('language', unset()));
			}
			return patches.length ? patches : undefined;
		},
	},
});
