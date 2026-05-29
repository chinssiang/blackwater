import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { TagsIcon } from '@sanity/icons';
import { defineType } from 'sanity';

export const pBlogCategory = defineType({
	title: 'Categories',
	name: 'pBlogCategory',
	type: 'document',
	icon: TagsIcon,
	fields: [
		{
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		},
		slug(),
		language(),
		{
			title: 'Category Color',
			name: 'categoryColor',
			type: 'reference',
			to: [{ type: 'settingsBrandColors' }],
		},
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
