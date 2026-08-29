import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { HelpCircleIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Dedicated FAQ page at /faq. Thin wrapper: holds title + SEO, and the ordered
// list of questions the page renders. Entry content is managed in Global → FAQ
// (gFaq); this document only decides which entries appear and in what order.
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
		defineField({
			name: 'questions',
			title: 'Questions',
			description:
				'The questions shown on this page, in this order. Entries are managed in Global → FAQ; an entry not listed here will not appear on this page.',
			type: 'array',
			of: [defineArrayMember({ type: 'reference', to: [{ type: 'gFaq' }] })],
			// Rule.unique() is load-bearing, not tidiness: FaqList keys each
			// accordion item by the entry's _id, so the same entry listed twice
			// yields two items sharing one value and both panels open together.
			//
			// Empty is a WARNING, not an error, deliberately. This field arrives on
			// an existing singleton whose documents only gain a list when
			// scripts/merge-faq-i18n.mjs runs — a separate, hand-run step — so a
			// hard `required()` makes both pFaq documents unpublishable for the
			// whole window between schema deploy and migration, blocking edits to
			// title, intro and sharing that have nothing to do with the FAQ list.
			// Worse, anything an editor types in to unblock themselves is then
			// overwritten wholesale by the migration. A warning says the same thing
			// without holding the document hostage, and an empty list is a coherent
			// state anyway: the page renders its title and intro.
			validation: (Rule) => [
				Rule.unique(),
				Rule.min(1).warning('With no questions listed, /faq renders nothing below the intro.'),
			],
		}),
		sharing(),
	],
	preview: {
		select: { title: 'title' },
		prepare({ title = 'FAQ Page' }) {
			return { title };
		},
	},
});
