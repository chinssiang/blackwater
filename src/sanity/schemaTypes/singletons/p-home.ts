import { PageModulesInput } from '@/sanity/schemaTypes/components/PageModulesInput';
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
			components: { input: PageModulesInput },
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
