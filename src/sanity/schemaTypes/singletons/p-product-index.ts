import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { StarIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

export const pProductIndex = defineType({
	title: 'Products',
	name: 'pProductIndex',
	type: 'document',
	icon: StarIcon,
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		slug({
			initialValue: { _type: 'slug', current: 'products' },
			readOnly: true,
		}),
		language(),
		defineField({
			name: 'subtitle',
			type: 'string',
			description: 'Tagline shown below the title',
		}),
		defineField({
			name: 'description',
			type: 'text',
			rows: 3,
			description: 'Hero banner tagline on dark background',
		}),
		defineField({
			name: 'categories',
			title: 'Categories',
			type: 'array',
			description:
				'Categories displayed on the index page, in order. If empty, all categories are shown alphabetically.',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pProductCategory' }],
				}),
			],
			validation: (Rule) => Rule.unique(),
		}),
		defineField({
			name: 'collections',
			title: 'Collections',
			type: 'array',
			description: 'Collections displayed on the index page, in order',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pProductCollection' }],
				}),
			],
			validation: (Rule) => Rule.unique(),
		}),
		sharing(),
	],
	preview: {
		select: { title: 'title' },
		prepare({ title = 'Untitled' }) {
			return { title };
		},
	},
});
