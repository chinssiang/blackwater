import { slug } from '@/sanity/schemaTypes/objects/slug';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { TagsIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const pCuratedCategory = defineType({
	title: 'Curated Category',
	name: 'pCuratedCategory',
	type: 'document',
	icon: TagsIcon,
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		slug(),
		customImage({
			title: 'Cover Image',
			name: 'coverImage',
			hasMobileOption: false,
			hasCaptionOption: false,
		}),
	],
	preview: {
		select: { title: 'title' },
		prepare: ({ title }) => ({ title }),
	},
});
