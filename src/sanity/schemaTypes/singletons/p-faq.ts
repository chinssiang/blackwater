import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { HelpCircleIcon } from '@sanity/icons';
import { defineType } from 'sanity';

// Dedicated FAQ page at /faq. Thin wrapper: holds title + SEO, renders the full
// global gFaq set (ordered). Content is managed in Global → FAQ (gFaq).
export const pFaq = defineType({
	title: 'FAQ Page',
	name: 'pFaq',
	type: 'document',
	icon: HelpCircleIcon,
	fields: [
		{ name: 'title', type: 'string', validation: (Rule) => [Rule.required()] },
		slug({ initialValue: { _type: 'slug', current: 'faq' }, readOnly: true }),
		language(),
		{
			name: 'intro',
			title: 'Intro',
			type: 'text',
			rows: 2,
			description: 'Optional short intro shown above the questions.',
		},
		sharing(),
	],
	preview: {
		select: { title: 'title' },
		prepare({ title = 'FAQ Page' }) {
			return { title };
		},
	},
});
