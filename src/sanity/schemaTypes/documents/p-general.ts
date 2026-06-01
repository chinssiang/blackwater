import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { defineType } from 'sanity';
import { localizePath, isLocale, DEFAULT_LOCALE } from '@/lib/i18n';

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
				'Optional modules rendered below the main content — e.g. an FAQ section.',
			of: [{ type: 'freeform' }, { type: 'faqList' }],
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
					? localizePath(`/${slug.current}`, isLocale(language) ? language : DEFAULT_LOCALE)
					: 'Missing page slug',
			};
		},
	},
});
