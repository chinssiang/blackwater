import { pageModuleComponents } from '@/sanity/schemaTypes/components/PageModuleItem';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import {
	moduleRule,
	pageModuleHidden,
} from '@/sanity/schemaTypes/objects/page-module';
import { SplitVerticalIcon } from '@sanity/icons';
import { toVimeoEmbedUrl } from '@/lib/vimeo';
import { defineField, defineType } from 'sanity';

// Editorial page module: an image beside or behind an eyebrow, heading,
// paragraph and call to action, for the middle of a page.
//
// Deliberately NOT a heroBlock layout. The hero is the page opener -- it fills
// the viewport, owns the weather widget, can run under the header and carries
// the wave canvas -- and an editorial section wants none of that. This one is
// sized by its content.
//
// The CTA is inline for the reason hero-block.ts gives (a plain string label in
// a document that is already one language), and it can either follow a link or
// open a video dialog.

type CtaParent = {
	label?: string;
	action?: string;
	link?: { href?: string; internalLink?: { _ref?: string } };
	video?: VideoValue;
};

type VideoValue = {
	source?: string;
	vimeoUrl?: string;
	file?: { asset?: { _ref?: string } };
};

// Whether each target actually points somewhere. Presence of the object alone
// is not enough: nested initialValues can create `link` and `video` before an
// editor touches them.
const hasLink = (link?: CtaParent['link']) =>
	!!(link?.href || link?.internalLink?._ref);

const hasVideo = (video?: VideoValue) =>
	video?.source === 'file' ? !!video.file?.asset?._ref : !!video?.vimeoUrl;

const opensVideo = (cta?: CtaParent) => cta?.action === 'video';

export const editorialBlock = defineType({
	name: 'editorialBlock',
	title: 'Editorial',
	type: 'object',
	icon: SplitVerticalIcon,
	components: pageModuleComponents,
	fields: [
		defineField({
			name: 'layout',
			title: 'Layout',
			type: 'string',
			options: {
				list: [
					{ title: 'Split — image fills half the width', value: 'split' },
					{ title: 'Background — image behind the text', value: 'background' },
				],
				layout: 'radio',
			},
			initialValue: 'split',
		}),
		defineField({
			name: 'imagePosition',
			title: 'Image position',
			type: 'string',
			options: {
				list: [
					{ title: 'Left', value: 'left' },
					{ title: 'Right', value: 'right' },
				],
				layout: 'radio',
				direction: 'horizontal',
			},
			initialValue: 'left',
			description: 'On phones the image always sits above the text.',
			hidden: ({ parent }) => parent?.layout === 'background',
		}),
		defineField({
			name: 'eyebrow',
			title: 'Eyebrow',
			type: 'string',
			description: 'Small kicker above the heading. Optional.',
		}),
		defineField({
			name: 'heading',
			title: 'Heading',
			type: 'string',
			// Not required, for the reason hero-block.ts gives.
		}),
		defineField({
			name: 'paragraph',
			title: 'Paragraph',
			type: 'portableTextSimple',
		}),
		customImage({
			name: 'image',
			title: 'Image',
			hasMobileOption: true,
			hasCaptionOption: false,
			hasCropOption: true,
			description:
				'In Split, Crop sets the image’s shape (without one it keeps its own proportions), but the image never grows taller than about 60% of the screen: a tall Crop such as 5:7 or 1:1 is trimmed to that height on wide screens. In Background, the image always covers the whole section. Wherever the image is trimmed to fit, set its hotspot (the focal-point tool in the image) to choose what stays in view.',
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
					// Symmetric with the target rules below, as in hero-block.ts: the
					// button renders only with a label AND a target.
					validation: (Rule) =>
						Rule.custom(
							moduleRule((value, context) => {
								const cta = context.parent as CtaParent | undefined;
								const target = opensVideo(cta) ? 'video' : 'link';
								const hasTarget =
									target === 'video'
										? hasVideo(cta?.video)
										: hasLink(cta?.link);
								return (
									!hasTarget ||
									!!value ||
									`Add a label, or clear the ${target}.`
								);
							})
						),
				}),
				defineField({
					name: 'action',
					title: 'Action',
					type: 'string',
					options: {
						list: [
							{ title: 'Go to a link', value: 'link' },
							{ title: 'Play a video', value: 'video' },
						],
						layout: 'radio',
						direction: 'horizontal',
					},
					initialValue: 'link',
				}),
				defineField({
					name: 'link',
					title: 'Link',
					type: 'link',
					hidden: ({ parent }) => opensVideo(parent),
					validation: (Rule) =>
						Rule.custom(
							moduleRule((_value, context) => {
								const cta = context.parent as CtaParent | undefined;
								return (
									opensVideo(cta) ||
									!cta?.label ||
									hasLink(cta?.link) ||
									'Add a link, or clear the label.'
								);
							})
						),
				}),
				defineField({
					name: 'video',
					title: 'Video',
					type: 'object',
					description: 'Opens in a dialog over the page.',
					hidden: ({ parent }) => !opensVideo(parent),
					fields: [
						defineField({
							name: 'source',
							title: 'Source',
							type: 'string',
							options: {
								list: [
									{ title: 'Vimeo', value: 'vimeo' },
									{ title: 'Upload a file', value: 'file' },
								],
								layout: 'radio',
								direction: 'horizontal',
							},
							initialValue: 'vimeo',
						}),
						defineField({
							name: 'vimeoUrl',
							title: 'Vimeo URL',
							// `string`, not `url`: the url type carries a built-in validator
							// that moduleRule cannot wrap, so a stray value would block
							// publishing a hidden module. The check lives on the object below.
							type: 'string',
							description:
								'The video’s share link, e.g. https://vimeo.com/123456789. Unlisted links with a hash work too.',
							hidden: ({ parent }) => parent?.source === 'file',
						}),
						defineField({
							name: 'file',
							title: 'Video file',
							type: 'file',
							options: { accept: 'video/mp4,video/webm' },
							description:
								'MP4 or WebM. Keep it compressed (1080p H.264 is plenty): the file streams from the Sanity CDN as-is. Uploads cannot carry captions yet, so put a video with speech on Vimeo instead.',
							hidden: ({ parent }) => parent?.source !== 'file',
						}),
					],
					// On the object rather than on `vimeoUrl`: only here can the rule see
					// the CTA's `action`, and a stale URL under a link CTA must not raise.
					// The URL error still lands on the URL field, through `path`.
					validation: (Rule) =>
						Rule.custom(
							moduleRule((value, context) => {
								const cta = context.parent as CtaParent | undefined;
								if (!opensVideo(cta)) return true;
								const video = value as VideoValue | undefined;
								if (
									video?.source !== 'file' &&
									video?.vimeoUrl &&
									!toVimeoEmbedUrl(video.vimeoUrl)
								) {
									return {
										message:
											'That is not a Vimeo video link. Paste one like https://vimeo.com/123456789.',
										path: ['vimeoUrl'],
									};
								}
								return (
									!cta?.label ||
									hasVideo(video) ||
									'Add a video, or clear the label.'
								);
							})
						),
				}),
			],
		}),
		defineField({
			name: 'sectionAppearance',
			type: 'sectionAppearance',
			description:
				'Max Width caps the text column only; the image always fills its half (Split) or the whole section (Background). “Full” uses a comfortable reading measure (~576px). Over a Background image the text sits on a 50% scrim of the section’s background colour.',
		}),
		pageModuleHidden(),
	],
	preview: {
		select: {
			heading: 'heading',
			layout: 'layout',
			imagePosition: 'imagePosition',
			media: 'image.image',
		},
		prepare({ heading, layout, imagePosition, media }) {
			return {
				title: heading || 'Editorial',
				subtitle:
					layout === 'background'
						? 'Background image'
						: `Split, image ${imagePosition === 'right' ? 'right' : 'left'}`,
				media,
			};
		},
	},
});
