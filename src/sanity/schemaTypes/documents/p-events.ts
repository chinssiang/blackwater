import { pickLocalizedValue, requireSomeValue } from '@/lib/i18n';
import { slug, isUniqueAcrossType } from '@/sanity/schemaTypes/objects/slug';
import { seoFieldset, seoFields } from '@/sanity/schemaTypes/objects/seo-fields';
import { BookIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const pEvents = defineType({
	title: 'Events',
	name: 'pEvents',
	type: 'document',
	icon: BookIcon,
	fieldsets: [
		seoFieldset,
	],
	fields: [
		defineField({
			name: 'title',
			type: 'internationalizedArrayString',
			validation: (Rule) => Rule.custom(requireSomeValue),
		}),
		// isUniqueAcrossType, not the default: with no `language` field the
		// default check short-circuits to `true` and accepts every duplicate.
		slug({
			initialValue: { _type: 'slug', current: 'events' },
			readOnly: true,
			isUnique: isUniqueAcrossType,
		}),
		...seoFields(),
	],
	preview: {
		select: {
			title: 'title',
		},
		prepare({ title }) {
			return {
				title: pickLocalizedValue(title) || 'Untitled',
			};
		},
	},
});
