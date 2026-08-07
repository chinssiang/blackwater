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
		// No `sharing()`: pEventCategory has no route (it is absent from
		// DOCUMENT_ROUTES and internalLink.to[]), so there is no page for the
		// meta title/description, share graphic or noindex flag to apply to.
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
