import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { TagsIcon } from '@sanity/icons';
import { defineType } from 'sanity';

export const pEventCategory = defineType({
	title: 'Categories',
	name: 'pEventCategory',
	type: 'document',
	icon: TagsIcon,
	fields: [
		{ name: 'title', type: 'string', validation: (Rule) => [Rule.required()] },
		slug(),
		language(),
		{
			title: 'Category Color',
			name: 'categoryColor',
			type: 'reference',
			to: [{ type: 'settingsBrandColors' }],
		},
		sharing(),
	],
	preview: {
		select: {
			title: 'title',
		},
		prepare: ({ title }) => ({
			title,
		}),
	},
});
