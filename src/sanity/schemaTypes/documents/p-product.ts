import { pickLocalizedValue, type Locale } from '@/lib/i18n';
import { resolveHref } from '@/lib/routes';
import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { StarIcon, ImageIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';
import customImage from '@/sanity/schemaTypes/objects/custom-image';

export const pProduct = defineType({
	title: 'Product',
	name: 'pProduct',
	type: 'document',
	icon: StarIcon,
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		slug(),
		language(),
		defineField({
			name: 'categories',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pProductCategory' }],
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
			validation: (Rule) => [Rule.required()],
		}),
		defineField({
			name: 'purchaseLink',
			title: 'Purchase Link',
			type: 'url',
		}),
		defineField({
			name: 'badge',
			title: 'Badge',
			type: 'array',
			of: [defineArrayMember({ type: 'string' })],
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
					to: [{ type: 'pProduct' }],
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
			language: 'language',
			categoryTitle: 'categories.0.title',
			mainImage: 'mainImage',
		},
		prepare({
			title = 'Untitled',
			slug = {},
			language,
			categoryTitle,
			mainImage,
		}: Record<string, any>) {
			const href = slug?.current
				? resolveHref({
						documentType: 'pProduct',
						slug: slug.current,
						locale: language as Locale,
					})
				: null;
			return {
				title,
				subtitle: `[${pickLocalizedValue(categoryTitle) ?? '(no category)'}] — ${href ?? '/products/(no slug)'}`,
				media: mainImage?.image.asset || ImageIcon,
			};
		},
	},
});
