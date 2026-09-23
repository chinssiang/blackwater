import { PageModulesInput } from '@/sanity/schemaTypes/components/PageModulesInput';
import { language } from '@/sanity/schemaTypes/objects/language';
import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { DEFAULT_LOCALE, isLocale, localizePath } from '@/lib/i18n';
import { defineType } from 'sanity';

export const pGeneral = defineType({
	title: 'Page',
	name: 'pGeneral',
	type: 'document',
	fields: [
		{ name: 'title', type: 'string', validation: (Rule) => [Rule.required()] },
		slug(),
		language(),
		{
			name: 'content',
			type: 'portableText',
		},
		{
			title: 'Page Modules',
			name: 'pageModules',
			type: 'array',
			description:
				'Optional sections rendered below the main content, in this order.',
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
			slug: 'slug',
			language: 'language',
		},
		prepare({ title = 'Untitled', slug = {}, language = '' }) {
			return {
				title,
				subtitle: slug?.current
					? localizePath(
							`/${slug.current}`,
							isLocale(language) ? language : DEFAULT_LOCALE
						)
					: 'Missing page slug',
			};
		},
	},
});
