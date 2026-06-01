import { HelpCircleIcon } from '@sanity/icons';
import { defineType, defineField } from 'sanity';

// FAQ page module. Surfaces an editor-chosen subset of the global gFaq pool.
// Content lives in gFaq documents (authored once); this module only selects
// which entries to show and how the section looks. Renders FAQPage JSON-LD.
export const faqList = defineType({
	name: 'faqList',
	title: 'FAQ',
	type: 'object',
	icon: HelpCircleIcon,
	fields: [
		defineField({
			name: 'heading',
			type: 'string',
			title: 'Heading',
			description: 'Optional section heading, e.g. "Frequently asked questions".',
		}),
		defineField({
			name: 'questions',
			title: 'Questions',
			type: 'array',
			description: 'Pick which FAQ entries to show here. Manage entries in Global → FAQ.',
			of: [{ type: 'reference', to: [{ type: 'gFaq' }] }],
			validation: (Rule) => Rule.min(1).unique(),
		}),
		defineField({
			name: 'sectionAppearance',
			type: 'sectionAppearance',
		}),
	],
	preview: {
		select: { heading: 'heading', questions: 'questions' },
		prepare({ heading, questions }) {
			const count = Array.isArray(questions) ? questions.length : 0;
			return {
				title: heading || 'FAQ',
				subtitle: `${count} question${count === 1 ? '' : 's'}`,
			};
		},
	},
});
