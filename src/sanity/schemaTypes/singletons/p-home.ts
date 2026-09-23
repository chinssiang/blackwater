import { language } from '@/sanity/schemaTypes/objects/language';
import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { defineType } from 'sanity';

export const pHome = defineType({
	title: 'Homepage',
	name: 'pHome',
	type: 'document',
	fields: [
		{ name: 'title', type: 'string', validation: (Rule) => [Rule.required()] },
		slug({ initialValue: { _type: 'slug', current: '/' }, readOnly: true }),
		language(),
		{
			// Retired by the one-shot migrate-home-hero script (deleted in 0db5fb7 once
			// both datasets were migrated), which moved the value into a heroBlock and
			// unset it. readOnly because PageHome fails the production build while a
			// non-blank value coexists with no modules -- an editor filling this in on
			// a fresh locale homepage took the build down once already -- and hidden
			// once empty, which every migrated document now is.
			title: 'Landing Title',
			name: 'landingTitle',
			type: 'string',
			readOnly: true,
			hidden: ({ value }) => !value,
			description:
				'Retired. The homepage heading now lives in a Hero page module.',
		},
		{
			title: 'Text Color',
			name: 'textColor',
			type: 'reference',
			to: [{ type: 'settingsBrandColors' }],
		},
		{
			title: 'Page Modules',
			name: 'pageModules',
			type: 'array',
			of: [
				{ type: 'heroBlock' },
				{ type: 'editorialBlock' },
				{ type: 'freeform' },
				{ type: 'faqBlock' },
				{ type: 'eventsBlock' },
				{ type: 'productsBlock' },
			],
		},
		sharing(),
	],
	preview: {
		select: {
			title: 'title',
		},
		prepare({ title = 'Untitled' }) {
			return {
				title,
			};
		},
	},
});
