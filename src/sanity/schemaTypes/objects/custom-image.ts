import { ImageIcon } from '@sanity/icons';
import {
	type FieldDefinitionBase,
	type ObjectDefinition,
	defineField,
} from 'sanity';

// Explicit rather than inferred from the defaults: the rest is spread onto the
// field definition, and an inferred type has no way to say so -- a caller
// passing `hidden` was an excess-property error even though it worked at
// runtime. Anything a field definition accepts passes through -- including the
// field-only `fieldset`/`group`, which live on FieldDefinitionBase, not on
// ObjectDefinition -- except what the factory owns (type, fields, icon,
// preview; options are merged, not replaced) and `validation`: this object is
// rendered inside page modules, where a validator cannot be wrapped in
// moduleRule() and would block publishing a parked module (page-module.ts).
// hero-block.ts passes `hidden` to collapse the whole image object while its
// wave background is selected.
type CustomImageProps = Partial<
	Omit<
		ObjectDefinition & FieldDefinitionBase,
		'type' | 'fields' | 'options' | 'icon' | 'preview' | 'validation'
	>
> & {
	hasMobileOption?: boolean;
	hasCaptionOption?: boolean;
	hasCropOption?: boolean;
	hasLinkOption?: boolean;
	options?: ObjectDefinition['options'];
};

export default function customImage({
	title = 'Image',
	name = 'imageBlock',
	hasMobileOption = true,
	hasCaptionOption = true,
	hasCropOption = false,
	hasLinkOption = false,
	options = {},
	...props
}: CustomImageProps = {}) {
	const crops = [
		{ title: '1 : 1 (square)', value: 1 },
		{ title: '5 : 7', value: 0.7142857143 },
		{ title: '4 : 6', value: 0.6666666667 },
		{ title: '16 : 9', value: 1.7777777778 },
	];

	return defineField({
		title: title || '',
		name: name,
		type: 'object',
		icon: ImageIcon,
		options: { collapsible: true, collapsed: false, ...options },
		fields: [
			defineField({
				title: `Image${hasMobileOption ? ' (Desktop)' : ''}`,
				name: 'image',
				type: 'image',
				// The crop tool plus a focal point. The CDN centres a Crop-ratio cut on
				// the hotspot, and SanityImage turns it into `object-position` for the
				// crops CSS makes (`object-cover`), so both kinds follow it.
				options: { hotspot: true },
			}),
			...(hasCropOption
				? [
						defineField({
							title: 'Crop',
							name: 'customRatio',
							type: 'number',
							options: {
								list: crops,
							},
						}),
					]
				: []),
			...(hasMobileOption
				? [
						defineField({
							title: 'Image (Mobile)',
							name: 'imageMobile',
							type: 'image',
							options: { collapsible: true, collapsed: true, hotspot: true },
						}),
					]
				: []),
			...(hasCropOption && hasMobileOption
				? [
						defineField({
							title: 'Crop (Mobile)',
							name: 'customRatioMobile',
							type: 'number',
							options: {
								list: crops,
							},
						}),
					]
				: []),
			...(hasCaptionOption
				? [
						defineField({
							title: 'Caption',
							name: 'caption',
							type: 'string',
						}),
					]
				: []),
			...(hasLinkOption
				? [
						defineField({
							name: 'link',
							type: 'link',
						}),
					]
				: []),
		],
		preview: {
			select: {
				// Relative to this object's own value, so no field-name prefix: the
				// former `imageBlock.image.asset` never resolved and every image
				// previewed as "Missing image".
				asset: 'image.asset',
				originalFilename: 'image.asset.originalFilename',
				caption: 'caption',
				customRatio: 'customRatio',
			},
			prepare({
				asset,
				originalFilename,
				caption,
				customRatio,
			}: Record<string, any>) {
				const crop = crops.find((crop) => crop?.value === customRatio);

				return {
					title: !asset ? 'Missing image' : caption || originalFilename,
					subtitle: crop?.title && `Crop: ${crop?.title}`,
					media: asset,
				};
			},
		},
		...props,
	});
}
