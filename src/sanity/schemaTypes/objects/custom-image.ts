import { ImageIcon } from '@sanity/icons';
import { defineField } from 'sanity';

export default function customImage({
	title = 'Image',
	name = 'imageBlock',
	hasMobileOption = true,
	hasCaptionOption = true,
	hasCropOption = false,
	hasLinkOption = false,
	options = {},
	...props
} = {}) {
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
							options: { collapsible: true, collapsed: true },
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
				asset: 'imageBlock.image.asset',
				originalFilename: 'imageBlock.image.asset.originalFilename',
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
