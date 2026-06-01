import { HelpCircleIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';
import { language } from '@/sanity/schemaTypes/objects/language';

// A single, globally reusable FAQ entry. Localized at the document level via the
// document-internationalization plugin (one doc per locale, like pGeneral/pEvent)
// so long rich-text answers stay tidy and scale to many languages. Referenced
// from FAQ modules and listed on the /faq page.
export const gFaq = defineType({
	title: 'FAQ',
	name: 'gFaq',
	type: 'document',
	icon: HelpCircleIcon,
	fields: [
		defineField({
			name: 'question',
			title: 'Question',
			type: 'string',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'answer',
			title: 'Answer',
			type: 'portableTextSimple',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'order',
			title: 'Order',
			type: 'number',
			description: 'Lower numbers appear first on the FAQ page.',
		}),
		language(),
	],
	orderings: [
		{
			title: 'Order',
			name: 'orderAsc',
			by: [{ field: 'order', direction: 'asc' }],
		},
	],
	preview: {
		select: { title: 'question', language: 'language' },
		prepare({ title, language }) {
			return {
				title: title || 'Untitled question',
				subtitle: language ? language.toUpperCase() : undefined,
				media: HelpCircleIcon,
			};
		},
	},
});
