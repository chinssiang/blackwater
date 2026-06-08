import { pickLocalizedValue } from '@/lib/i18n';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { TagIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const gTag = defineType({
	title: 'Tag',
	name: 'gTag',
	type: 'document',
	icon: TagIcon,
	fields: [
		defineField({
			name: 'title',
			title: 'Title',
			type: 'internationalizedArrayString',
			validation: (Rule) => Rule.required(),
		}),
		slug({ hideViewPage: true }),
	],
	preview: {
		select: { title: 'title' },
		prepare: ({ title }) => ({ title: pickLocalizedValue(title) || 'Untitled' }),
	},
});
