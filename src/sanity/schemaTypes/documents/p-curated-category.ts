import { pickLocalizedValue } from '@/lib/i18n';
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
			title: 'Title',
			type: 'internationalizedArrayString',
		}),
		defineField({
			name: 'description',
			title: 'Description',
			type: 'internationalizedArrayText',
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
		select: { title: 'title', description: 'description' },
		prepare: ({ title, description }) => {
			return {
				title: pickLocalizedValue(title) || 'Untitled',
				subtitle: pickLocalizedValue(description),
			};
		},
	},
});
