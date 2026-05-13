import { defineField } from 'sanity';
import { link } from '@/sanity/schemaTypes/objects/link';
import { PortableTextNormalizer } from '@/sanity/schemaTypes/components/PortableTextNormalizer';

export const portableTextSimple = defineField({
	name: 'portableTextSimple',
	type: 'array',
	components: {
		// See note in portable-text.tsx — bridge Sanity's primitives inference.
		input: PortableTextNormalizer as unknown as never,
	},
	of: [
		{
			title: 'Block',
			type: 'block',
			styles: [{ title: 'Paragraph', value: 'normal' }],
			lists: [],
			marks: {
				decorators: [
					{ title: 'Bold', value: 'strong' },
					{ title: 'Italic', value: 'em' },
					{ title: 'Underline', value: 'underline' },
					{ title: 'Strike', value: 'strike-through' },
				],
				annotations: [
					link({
						showLabel: false,
						options: {
							modal: { type: 'dialog' },
						},
					}),
				],
			},
		},
	],
});
