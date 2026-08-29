import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { HelpCircleIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

// Dedicated FAQ page at /faq. Thin wrapper: holds title, intro + SEO, and a
// pointer at the FAQ set it renders.
//
// It points at a set rather than curating its own list because this document is
// localized at the DOCUMENT level — there are two of them, one per locale — and
// an inline array meant maintaining the same fifteen questions twice. The set
// (gFaqList) carries no locale, so both pages render one list.
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
			name: 'faqSet',
			title: 'Questions',
			type: 'reference',
			to: [{ type: 'gFaqList' }],
			description:
				'Which FAQ set this page shows. Sets are managed in Global → FAQ Sets. Both language versions of this page should point at the same set — that is what keeps the two FAQ pages in step.',
			// A WARNING, not an error, for the same reason the inline `questions`
			// array this replaced carried one: the field arrives on documents that
			// only gain a value when scripts/create-faq-sets.mjs runs, a separate
			// hand-run step. A hard required() makes both prod pFaq documents
			// unpublishable for the whole window between deploying this schema and
			// running that script, blocking unrelated edits to title, intro and SEO
			// — and an editor who breaks the deadlock by picking a set by hand has
			// it overwritten by the migration anyway.
			//
			// Tighten to Rule.required() once prod is migrated. (faqBlock.faqSet is
			// required today and correctly so: those modules are editor-created
			// from here on, so they have no migration window.)
			validation: (Rule) =>
				Rule.custom((value) =>
					value
						? true
						: 'Pick the FAQ set this page renders — without one, /faq shows only its title and intro.'
				).warning(),
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
