import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { StarIcon, ImageIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';
import customImage from '@/sanity/schemaTypes/objects/custom-image';

export const pCurated = defineType({
	title: 'Curated Product',
	name: 'pCurated',
	type: 'document',
	icon: StarIcon,
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		slug(),
		defineField({
			name: 'categories',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pCuratedCategory' }],
				}),
			],
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'brands',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pBrand' }],
				}),
			],
			validation: (Rule) => Rule.unique(),
		}),
		customImage({ title: 'Main Image', name: 'mainImage' }),
		defineField({
			name: 'price',
			type: 'string',
			description: 'e.g. $1,299 or From $49/mo',
		}),
		defineField({
			name: 'purchaseLink',
			title: 'Purchase Link',
			type: 'url',
		}),
		defineField({
			name: 'badge',
			title: 'Badge',
			type: 'string',
			options: {
				list: [
					{ title: "Founder's Pick", value: "Founder's Pick" },
					{ title: 'Most Popular', value: 'Most Popular' },
					{ title: 'New', value: 'New' },
					{ title: "Editor's Choice", value: "Editor's Choice" },
				],
			},
		}),
		defineField({
			name: 'excerpt',
			type: 'text',
			rows: 3,
			description: 'Short description shown on listing cards',
			validation: (Rule) => Rule.max(200).warning('Keep under 200 characters'),
		}),
		defineField({
			name: 'content',
			type: 'portableText',
		}),
		defineField({
			title: 'Related Products',
			name: 'relatedProducts',
			type: 'array',
			description: 'If left empty, will pull products from the same category',
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
			slug: 'slug',
			categoryTitle: 'categories.0.title',
			mainImage: 'mainImage',
		},
		prepare({
			title = 'Untitled',
			slug = {},
			categoryTitle,
			mainImage,
		}: Record<string, any>) {
			return {
				title,
				subtitle: `[${categoryTitle ?? '(no category)'}] — /curated/products/${slug?.current ?? '(no slug)'}`,
				media: mainImage?.image.asset || ImageIcon,
			};
		},
	},
});
