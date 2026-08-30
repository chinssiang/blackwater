import { BlockElementIcon } from '@sanity/icons';
import { defineType, defineField } from 'sanity';
import customImage from '@/sanity/schemaTypes/objects/custom-image';

// Hero page module: the opening statement of a page -- an eyebrow, a heading, a
// short paragraph and an optional call to action, over an optional background
// image.
//
// This is where the home page's heading lives now. It used to be `landingTitle`,
// a bare string on pHome rendered above the modules by PageHome, which meant the
// one page that most needs a designed opener was the one page whose opener could
// not be edited, moved or given an image.
//
// The call to action is a plain string label plus a link, following p-404.ts
// rather than the shared objects/call-to-action.js: that one's label is an
// internationalizedArrayString, and pHome/pGeneral are document-localized, so it
// would ask an editor to fill a language array inside a document that is already
// one language.

export const heroBlock = defineType({
	name: 'heroBlock',
	title: 'Hero',
	type: 'object',
	icon: BlockElementIcon,
	fields: [
		defineField({
			name: 'eyebrow',
			title: 'Eyebrow',
			type: 'string',
			description:
				'Small kicker above the heading, e.g. a season or a date. Optional.',
		}),
		defineField({
			name: 'heading',
			title: 'Heading',
			type: 'string',
			description:
				'On the homepage this is the page’s main heading (h1). Elsewhere it sits below the page title as a section heading.',
			// Deliberately NOT required, for the reason eventsBlock.timeWindow and
			// productsBlock.source give: the component renders whatever is present,
			// and requiring it would make a host page unpublishable over a module
			// written through the API or half-drafted.
		}),
		defineField({
			name: 'paragraph',
			title: 'Paragraph',
			type: 'portableTextSimple',
		}),
		customImage({
			name: 'backgroundImage',
			title: 'Background image',
			hasMobileOption: true,
			hasCaptionOption: false,
			hasCropOption: true,
			options: { collapsible: true, collapsed: true },
		}),
		defineField({
			name: 'callToAction',
			title: 'Call to action',
			type: 'object',
			options: { collapsible: true, collapsed: true },
			fields: [
				defineField({
					name: 'label',
					title: 'Label',
					type: 'string',
					// Both halves are validated, and symmetrically: the button only
					// renders when it has a label AND a link, so a link with no label is
					// exactly as silently broken as a label with no link.
					validation: (Rule) =>
						Rule.custom((value, context) => {
							const link = (context.parent as { link?: unknown } | undefined)
								?.link;
							return !link || !!value || 'Add a label, or clear the link.';
						}),
				}),
				defineField({
					name: 'link',
					title: 'Link',
					type: 'link',
					// Conditional rather than plain required: a hero with no CTA at all
					// is the common case, and an empty collapsed object must not block
					// publishing. Only a half-filled one is an error.
					validation: (Rule) =>
						Rule.custom((value, context) => {
							const label = (context.parent as { label?: string } | undefined)
								?.label;
							return !label || !!value || 'Add a link, or clear the label.';
						}),
				}),
			],
		}),
		defineField({
			name: 'sectionAppearance',
			type: 'sectionAppearance',
			description:
				'Set Text Color as well as Background Color — text does not pick its own contrast, and a background image needs a colour that survives it.',
		}),
	],
	preview: {
		select: {
			heading: 'heading',
			eyebrow: 'eyebrow',
			media: 'backgroundImage.image',
		},
		prepare({ heading, eyebrow, media }) {
			return {
				title: heading || 'Hero',
				subtitle: eyebrow || undefined,
				media,
			};
		},
	},
});
