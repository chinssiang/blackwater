import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { defineType } from 'sanity';

export const pGeneral = defineType({
	title: 'Page',
	name: 'pGeneral',
	type: 'document',
	fields: [
		{ name: 'title', type: 'string', validation: (Rule) => [Rule.required()] },
		slug(),
		{
			name: 'content',
			type: 'portableText',
		},
		sharing(),
	],
	preview: {
		select: {
			title: 'title',
			slug: 'slug',
		},
		prepare({ title = 'Untitled', slug = {} }) {
			return {
				title,
				subtitle: slug?.current ? `/${slug.current}` : 'Missing page slug',
			};
		},
	},
});
