import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { StarIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

export const pCuratedIndex = defineType({
	title: 'Curated',
	name: 'pCuratedIndex',
	type: 'document',
	icon: StarIcon,
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		slug({
			initialValue: { _type: 'slug', current: 'curated' },
			readOnly: true,
		}),
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
					to: [{ type: 'pCuratedCategory' }],
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
					to: [{ type: 'pCuratedCollection' }],
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
