import { CalendarIcon } from '@sanity/icons';
import { defineType, defineField } from 'sanity';
import { pageModuleComponents } from '@/sanity/schemaTypes/components/PageModuleItem';
import {
	moduleRule,
	pageModuleHidden,
} from '@/sanity/schemaTypes/objects/page-module';

// Upcoming-events page module: a compact strip of the events that have not yet
// happened, pulled automatically rather than curated. Nothing here names an
// event -- the editor picks a window and a count, and the block follows the
// calendar on its own.
//
// Automatic on purpose. A hand-picked list of events is a list that is wrong the
// morning after each one runs, and pHome/pGeneral are document-localized, so it
// would be wrong once per language.
//
// The window and the count are applied in React, not in GROQ — see
// selectUpcomingEvents in src/lib/event-date.ts for why.

// Declared once so the preview cannot describe a window by a label the picker no
// longer offers.
const TIME_WINDOWS = [
	{ title: 'Next 7 days', value: 'week' },
	{ title: 'Next 30 days', value: 'month' },
	{ title: 'All upcoming', value: 'all' },
] as const;

export const eventsBlock = defineType({
	name: 'eventsBlock',
	// Explicit: without it the Studio would label this "Events Block".
	title: 'Upcoming events',
	type: 'object',
	icon: CalendarIcon,
	components: pageModuleComponents,
	fields: [
		defineField({
			name: 'heading',
			type: 'string',
			title: 'Heading',
			description: 'Optional section heading, e.g. "What’s coming up".',
		}),
		defineField({
			name: 'timeWindow',
			title: 'Show events',
			type: 'string',
			options: { list: [...TIME_WINDOWS], layout: 'radio' },
			initialValue: 'all',
			description:
				'A narrow window can be empty -- in a week with no events the whole section disappears from the page rather than rendering an empty heading. Use "All upcoming" if the section must always be visible.',
			// Deliberately NOT required, for the reason faqBlock.source gives: the
			// component already defaults this, so requiring it would call a module
			// written through the API invalid and make its host page unpublishable
			// over a radio the editor never saw. initialValue covers the Studio.
		}),
		defineField({
			name: 'limit',
			title: 'How many',
			type: 'number',
			options: {
				list: [
					{ title: '3 events', value: 3 },
					{ title: '5 events', value: 5 },
					{ title: '10 events', value: 10 },
				],
				layout: 'radio',
			},
			initialValue: 5,
			// Not required, same reasoning as `timeWindow`.
		}),
		// The third hand-rolled plain-label CTA object, after p-404.ts and
		// hero-block.ts, and the second copy of the symmetric validation pair.
		// call-to-action.js already exports a factory, but it does not fit any of
		// the three: its label is internationalizedArrayString (wrong for hosts
		// that are document-localized) and its link is unconditionally required.
		// Teaching it a plain-label mode is the right fix and is deliberately NOT
		// done here -- heroBlock is mid content-migration (see migrate-home-hero,
		// unrun in prod), and reshaping its schema during that is the wrong trade.
		// Do it once the hero migration lands.
		defineField({
			name: 'callToAction',
			title: 'Call to action',
			description:
				'Optional. Shown beside the heading. Leave empty and it still links to the events page with the default wording -- fill this in only to point somewhere else or reword it. There is no way to hide it entirely.',
			type: 'object',
			options: { collapsible: true, collapsed: true },
			fields: [
				defineField({
					name: 'label',
					title: 'Label',
					// A plain string, not internationalizedArrayString: pHome/pGeneral
					// are document-localized, so this module already exists once per
					// language. Same call hero-block.ts makes.
					type: 'string',
					// Both halves validated, and symmetrically: a label with no link is
					// exactly as silently broken as a link with no label.
					validation: (Rule) =>
						Rule.custom(
							moduleRule((value, context) => {
								const link = (context.parent as { link?: unknown } | undefined)
									?.link;
								return !link || !!value || 'Add a label, or clear the link.';
							})
						),
				}),
				defineField({
					name: 'link',
					title: 'Link',
					type: 'link',
					// Conditional rather than plain required: no CTA at all is the
					// common case here (the component falls back to the events page),
					// and an empty collapsed object must never block publishing.
					validation: (Rule) =>
						Rule.custom(
							moduleRule((value, context) => {
								const label = (context.parent as { label?: string } | undefined)
									?.label;
								return !label || !!value || 'Add a link, or clear the label.';
							})
						),
				}),
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
			timeWindow: 'timeWindow',
			limit: 'limit',
		},
		prepare({ heading, timeWindow, limit }) {
			const windowLabel =
				TIME_WINDOWS.find((w) => w.value === timeWindow)?.title ??
				'All upcoming';
			return {
				title: heading || 'Upcoming events',
				subtitle: limit ? `${windowLabel} · up to ${limit}` : windowLabel,
			};
		},
	},
});
