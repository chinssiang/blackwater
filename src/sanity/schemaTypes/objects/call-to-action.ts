import type { LinkFactoryArgs } from '@/sanity/schemaTypes/objects/link';
import { FiExternalLink } from 'react-icons/fi';
import { defineField } from 'sanity';

export default function callToAction({
	title,
	name = 'callToAction',
	showLabel = true,
	...props
}: LinkFactoryArgs = {}) {
	return {
		...defineField({
			title: title || '',
			name: name,
			type: 'object',
			icon: FiExternalLink,
			fields: [
				...(showLabel
					? [
							defineField({
								name: 'label',
								title: 'Label',
								type: 'internationalizedArrayString',
							}),
						]
					: []),
				defineField({
					name: 'link',
					title: 'Link',
					type: 'link',
					// `Rule` is inferred by defineField. The hand-rolled
					// `{ required: () => unknown }` stand-in this replaces matched any
					// object with a `required()` method, so `.min()` or `.custom()` would
					// not have type-checked here.
					validation: (Rule) => Rule.required(),
				}),
			],
		}),
		...props,
	};
}
