import { BlockElementIcon } from '@sanity/icons';
import { defineType, defineField } from 'sanity';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { pageModuleComponents } from '@/sanity/schemaTypes/components/PageModuleItem';
import {
	moduleRule,
	pageModuleHidden,
} from '@/sanity/schemaTypes/objects/page-module';

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
	components: pageModuleComponents,
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
		defineField({
			name: 'backgroundEffect',
			title: 'Background effect',
			type: 'string',
			options: {
				list: [
					{ title: 'None', value: 'none' },
					{ title: 'Animated wave', value: 'wave' },
				],
				layout: 'radio',
			},
			description:
				'Animated wave paints a slowly moving dark canvas behind the copy and replaces the background image while selected. Text falls back to a light ink over it unless Text Color is set.',
			// No initialValue and no validation: absent means none, so existing
			// heroes are untouched, and a required rule would block publishing a
			// parked module (see moduleRule in page-module.ts).
		}),
		customImage({
			name: 'backgroundImage',
			title: 'Background image',
			hasMobileOption: true,
			hasCaptionOption: false,
			hasCropOption: true,
			options: { collapsible: true, collapsed: true },
			// Hidden, not removed, while the wave is selected: the canvas is opaque,
			// so an image beneath it could never show. Switching back restores it.
			hidden: ({ parent }) => parent?.backgroundEffect === 'wave',
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
					// Conditional rather than plain required: a hero with no CTA at all
					// is the common case, and an empty collapsed object must not block
					// publishing. Only a half-filled one is an error.
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
			description:
				'A plain Background Color earns a legible default ink (so does the wave); a background image does not, so set a Text Color that survives it.',
		}),
		pageModuleHidden(),
	],
	preview: {
		select: {
			heading: 'heading',
			eyebrow: 'eyebrow',
			media: 'backgroundImage.image',
			backgroundEffect: 'backgroundEffect',
		},
		prepare({ heading, eyebrow, media, backgroundEffect }) {
			return {
				title: heading || 'Hero',
				subtitle: eyebrow || undefined,
				// The image field is hidden, not cleared, while the wave is selected,
				// so its thumbnail would otherwise keep showing for a canvas.
				media: backgroundEffect === 'wave' ? undefined : media,
			};
		},
	},
});
