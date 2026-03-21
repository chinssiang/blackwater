import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { StackIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

export const pCuratedCollection = defineType({
	title: 'Curated Collection',
	name: 'pCuratedCollection',
	type: 'document',
	icon: StackIcon,
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		slug(),
		defineField({
			name: 'description',
			type: 'text',
			rows: 3,
			description: 'Short description shown on the collection section',
		}),
		customImage({ title: 'Cover Image', name: 'coverImage' }),
		defineField({
			name: 'products',
			title: 'Products',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pCurated' }],
				}),
			],
			validation: (Rule) => Rule.unique(),
		}),
		sharing(),
	],
	preview: {
		select: {
			title: 'title',
			media: 'coverImage.image.asset',
		},
		prepare({ title = 'Untitled', media }) {
			return { title, media: media || StackIcon };
		},
	},
});
