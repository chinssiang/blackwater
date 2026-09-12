import { pickLocalizedValue } from '@/lib/i18n';
import { ViewPageField } from '@/sanity/schemaTypes/components/ViewPageField';
import { defineField, SlugValidationContext } from 'sanity';

export async function isUniqueOtherThanLanguage(
	slug: string,
	context: SlugValidationContext
) {
	const { document, getClient } = context;
	if (!document?.language) {
		return true;
	}
	const client = getClient({ apiVersion: '2025-02-19' });
	const id = document._id.replace(/^drafts\./, '');
	const params = {
		id,
		type: document._type,
		language: document.language,
		slug,
	};
	const query = `!defined(*[
    !(sanity::versionOf($id)) &&
    _type == $type &&
    slug.current == $slug &&
    language == $language
  ][0]._id)`;
	const result = await client.fetch(query, params);
	return result;
}

/**
 * Uniqueness check for document types that are NOT document-localized (no
 * `language` field), where `isUniqueOtherThanLanguage` would short-circuit to
 * `true` and silently validate every duplicate. Matches on type + slug only.
 */
export async function isUniqueAcrossType(
	slug: string,
	context: SlugValidationContext
) {
	const { document, getClient } = context;
	if (!document) return true;
	const client = getClient({ apiVersion: '2025-02-19' });
	const id = document._id.replace(/^drafts\./, '');
	const query = `!defined(*[
    !(sanity::versionOf($id)) &&
    _type == $type &&
    slug.current == $slug
  ][0]._id)`;
	return client.fetch(query, { id, type: document._type, slug });
}

type SlugFieldOptions = {
	initialValue?: {_type: 'slug'; current: string};
	readOnly?: boolean;
	group?: string | string[];
	// Hide the "View page" link (ViewPageField) for document types that have no
	// front-end route — e.g. gTag — where the link would resolve to nothing.
	hideViewPage?: boolean;
	// Override the uniqueness check. Types without a `language` field must pass
	// `isUniqueAcrossType`, because the default short-circuits to `true` for them.
	isUnique?: typeof isUniqueOtherThanLanguage;
};

export function slug({
	initialValue,
	readOnly,
	group,
	hideViewPage,
	isUnique = isUniqueOtherThanLanguage,
}: SlugFieldOptions = {}) {
	return defineField({
		title: 'Slug (Page URL)',
		name: 'slug',
		type: 'slug',
		...(hideViewPage ? {} : { components: { field: ViewPageField } }),
		options: {
			// Resolve the slug source through pickLocalizedValue so it works for
			// both plain-string titles and internationalizedArray titles (returns
			// plain strings unchanged).
			source: (doc) => pickLocalizedValue((doc as { title?: unknown }).title) ?? '',
			maxLength: 200,
			isUnique,
			slugify: (input) => {
				if (!input) return '';
				// Convert common ligatures to their regular character equivalents
				const decomposedInput = input
					// Latin ligatures
					.replace(/œ/g, 'oe')
					.replace(/æ/g, 'ae')
					.replace(/Œ/g, 'OE')
					.replace(/Æ/g, 'AE')
					// Germanic ligatures
					.replace(/ĳ/g, 'ij')
					.replace(/Ĳ/g, 'IJ')
					// Historical ligatures
					.replace(/ﬀ/g, 'ff')
					.replace(/ﬁ/g, 'fi')
					.replace(/ﬂ/g, 'fl')
					.replace(/ﬃ/g, 'ffi')
					.replace(/ﬄ/g, 'ffl')
					.replace(/ﬅ/g, 'ft')
					.replace(/ﬆ/g, 'st');

				return decomposedInput
					.toLowerCase()
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '')
					.replace(/[’'`]/g, '')
					.replace(/[^\p{Letter}\p{Number}\s-]+/gu, '')
					.replace(/[\s\W-]+/g, '-')
					.replace(/^-+|-+$/g, '')
					.slice(0, 200);
			},
		},
		validation: (Rule) => [Rule.required()],
		initialValue: initialValue,
		readOnly: ({ value, currentUser }) => {
			if (!value) {
				return false;
			}

			const isAdmin = currentUser?.roles.some(
				(role) => role.name === 'administrator'
			);

			// Only admins can change the slug
			return readOnly || !isAdmin;
		},
		group: group,
	});
}
