import { HelpCircleIcon } from '@sanity/icons';
import { defineArrayMember, defineType, defineField } from 'sanity';
import { pageModuleComponents } from '@/sanity/schemaTypes/components/PageModuleItem';
import {
	moduleRule,
	pageModuleHidden,
} from '@/sanity/schemaTypes/objects/page-module';

// FAQ page module: one rendered block of questions, with a heading and section
// appearance of its own. Question content lives in gFaq (authored once, both
// languages); this decides which questions appear here and how the block looks.
//
// Two sources: a FAQ SET (gFaqList), or hand-picked questions. Hand-picked is
// per-language, which is bounded rather than merely convenient — this module
// lives on pHome/pGeneral, which are document-localized, so its `heading` and
// `sectionAppearance` are ALREADY curated once per locale. An inline list adds
// one more per-locale field to a module that is already per-locale, and the
// blast radius is one block on one page. That is a different proposition from
// /faq, whose entire content IS the list, which is why pFaq always uses a set.
//
// Renders FAQPage JSON-LD.

// Reads the `source` discriminant off the enclosing module. `parent`, not
// `document`: inside pageModules[] the document is the PAGE, so a predicate
// keyed off it would read the wrong object entirely. Shared by the `hidden` and
// `validation` of both source-dependent fields, which have to agree — a field is
// exempt from validation on exactly the condition that hides it.
const sourceOf = (owner: { parent?: unknown }) =>
	(owner.parent as { source?: string } | undefined)?.source;

export const faqBlock = defineType({
	name: 'faqBlock',
	// Explicit: without it the Studio would label this "Faq Block".
	title: 'FAQ',
	type: 'object',
	icon: HelpCircleIcon,
	components: pageModuleComponents,
	fields: [
		defineField({
			name: 'heading',
			type: 'string',
			title: 'Heading',
			description:
				'Optional section heading, e.g. "Frequently asked questions".',
		}),
		defineField({
			name: 'source',
			title: 'Questions from',
			type: 'string',
			options: {
				list: [
					{ title: 'A FAQ set', value: 'set' },
					{ title: 'Hand-picked questions', value: 'picked' },
				],
				layout: 'radio',
			},
			initialValue: 'set',
			// Deliberately NOT required. faqBlockField treats a missing `source` as
			// the set arm, so a module written through the API or an import renders
			// correctly; requiring it here would call that same module invalid and
			// make its host page unpublishable over a radio the editor never set.
			// `initialValue` covers everything created in the Studio.
		}),
		defineField({
			name: 'faqSet',
			title: 'FAQ set',
			type: 'reference',
			to: [{ type: 'gFaqList' }],
			description:
				'Sets are managed in Global → FAQ Sets. Both language versions of this page can point at the same set, so reordering it moves both.',
			hidden: (owner) => sourceOf(owner) !== 'set',
			// Conditional so a hidden field never blocks publishing — only the one
			// the editor can actually see. `moduleRule` extends that to the module
			// itself: a section switched off with the eye button must not hold its
			// page unpublishable either.
			validation: (Rule) =>
				Rule.custom(
					moduleRule(
						(value, context) =>
							sourceOf(context) !== 'set' ||
							!!value ||
							'Pick a FAQ set, or switch to hand-picked questions.'
					)
				),
		}),
		defineField({
			name: 'questions',
			title: 'Questions',
			type: 'array',
			description:
				'Only on this page, in this language — the other language version of this page keeps its own list and will not follow these edits. Use a FAQ set instead when both should stay in step.',
			of: [defineArrayMember({ type: 'reference', to: [{ type: 'gFaq' }] })],
			hidden: (owner) => sourceOf(owner) !== 'picked',
			validation: (Rule) => [
				// Unconditional, and load-bearing for the same reason it is on
				// gFaqList.questions — see the note there. Deliberately NOT wrapped in
				// moduleRule: an incomplete module is a work-in-progress the eye can
				// park, but a duplicate reference is a data error that will still be
				// wrong when the module is switched back on.
				Rule.unique(),
				Rule.custom(
					moduleRule(
						(value, context) =>
							sourceOf(context) !== 'picked' ||
							(Array.isArray(value) && value.length > 0) ||
							'Pick at least one question, or switch to a FAQ set.'
					)
				),
			],
		}),
		defineField({
			name: 'sectionAppearance',
			type: 'sectionAppearance',
		}),
		pageModuleHidden(),
	],
	preview: {
		select: {
			heading: 'heading',
			source: 'source',
			setTitle: 'faqSet.title',
			questions: 'questions',
		},
		prepare({ heading, source, setTitle, questions }) {
			const count = Array.isArray(questions) ? questions.length : 0;
			return {
				title: heading || 'FAQ',
				subtitle:
					source === 'picked'
						? `${count} hand-picked question${count === 1 ? '' : 's'}`
						: setTitle || 'No set selected',
			};
		},
	},
});
