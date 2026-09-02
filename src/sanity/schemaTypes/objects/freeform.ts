import { getPortableTextPreview } from '@/sanity/lib/utils';
import type { PortableTextBlock } from '@portabletext/types';
import { EditIcon } from '@sanity/icons';
import { defineType } from 'sanity';
import { pageModuleComponents } from '@/sanity/schemaTypes/components/PageModuleItem';
import { pageModuleHidden } from '@/sanity/schemaTypes/objects/page-module';

export const freeform = defineType({
	name: 'freeform',
	type: 'object',
	icon: EditIcon,
	components: pageModuleComponents,
	fields: [
		{
			name: 'content',
			type: 'portableText',
		},
		{
			name: 'sectionAppearance',
			type: 'sectionAppearance',
		},
		pageModuleHidden(),
	],
	preview: {
		select: {
			content: 'content',
		},
		prepare({ content }) {
			const firstImage = content
				? content.find((item: PortableTextBlock) => item._type === 'image')
				: null;

			return {
				title: getPortableTextPreview(content),
				subtitle: 'Freeform',
				media: firstImage || EditIcon,
			};
		},
	},
});
