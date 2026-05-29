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

type SlugFieldOptions = {
	initialValue?: {_type: 'slug'; current: string};
	readOnly?: boolean;
	group?: string | string[];
};

export function slug({ initialValue, readOnly, group }: SlugFieldOptions = {}) {
	return defineField({
		title: 'Slug (Page URL)',
		name: 'slug',
		type: 'slug',
		components: {
			field: ViewPageField,
		},
		options: {
			source: 'title',
			maxLength: 200,
			isUnique: isUniqueOtherThanLanguage,
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
