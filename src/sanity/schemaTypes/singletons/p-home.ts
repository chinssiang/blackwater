import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
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
			// Retired by scripts/migrate-home-hero.mjs, which moves the value into a
			// heroBlock and unsets it. readOnly because PageHome fails the production
			// build while a non-blank value coexists with no modules -- an editor
			// filling this in on a fresh locale homepage took the build down once
			// already. `hidden` once empty so the field disappears the moment a
			// document is migrated, leaving it visible only where it still matters.
			title: 'Landing Title',
			name: 'landingTitle',
			type: 'string',
			readOnly: true,
			hidden: ({ value }) => !value,
			description:
				'Retired. Superseded by a Hero page module; run scripts/migrate-home-hero.mjs to carry it over.',
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
