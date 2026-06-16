import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { EnvelopeIcon } from '@sanity/icons';
import { defineType } from 'sanity';

// Dedicated newsletter page at /newsletter. Thin wrapper: holds title + SEO,
// renders the existing signup form. Form content is managed in the Newsletter
// Form (gNewsletter) singleton.
export const pNewsletter = defineType({
	title: 'Newsletter Page',
	name: 'pNewsletter',
	type: 'document',
	icon: EnvelopeIcon,
	fields: [
		{ name: 'title', type: 'string', validation: (Rule) => [Rule.required()] },
		slug({ initialValue: { _type: 'slug', current: 'newsletter' }, readOnly: true }),
		language(),
		{
			name: 'intro',
			title: 'Intro',
			type: 'text',
			rows: 2,
			description: 'Optional short intro shown above the signup form.',
		},
		sharing(),
	],
	preview: {
		select: { title: 'title' },
		prepare({ title = 'Newsletter Page' }) {
			return { title };
		},
	},
});
