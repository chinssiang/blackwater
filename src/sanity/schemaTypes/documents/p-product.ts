import {
	pickLocalizedValue,
	isLocale,
	LOCALE_SHORT_LABELS,
	type Locale,
} from '@/lib/i18n';
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
					{ title: "Founder's Pick", value: 'founders-pick' },
					{ title: 'Most Popular', value: 'most-popular' },
					{ title: "Editor's Choice", value: 'editors-choice' },
					{ title: 'New', value: 'new' },
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
			type: 'portableTextSimple',
		}),
		defineField({
			name: 'whyUseIt',
			title: 'Why do we use it?',
			type: 'portableTextSimple',
		}),
		defineField({
			name: 'whoIsItFor',
			title: 'Who is it for?',
			type: 'portableTextSimple',
		}),
		defineField({
			name: 'whenReachForIt',
			title: 'When do we reach for it?',
			type: 'object',
			fields: [
				defineField({
					name: 'contentType',
					title: 'Content Type',
					type: 'string',
					options: {
						list: [
							{ title: 'Rich Text', value: 'richText' },
							{ title: 'Tags / Text List', value: 'list' },
						],
						layout: 'radio',
					},
					initialValue: 'richText',
				}),
				defineField({
					name: 'richText',
					title: 'Rich Text',
					type: 'portableTextSimple',
					hidden: ({ parent }) => parent?.contentType !== 'richText',
				}),
				defineField({
					name: 'list',
					title: 'Tags / Text List',
					type: 'array',
					of: [
						defineArrayMember({
							type: 'reference',
							to: [{ type: 'gTag' }],
						}),
						defineArrayMember({
							type: 'object',
							name: 'textItem',
							title: 'Text',
							fields: [
								defineField({
									name: 'text',
									type: 'string',
									validation: (Rule) => Rule.required(),
								}),
							],
							preview: { select: { title: 'text' } },
						}),
					],
					hidden: ({ parent }) => parent?.contentType !== 'list',
				}),
			],
		}),
		defineField({
			name: 'metadata',
			title: 'Metadata',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'object',
					name: 'metadataItem',
					title: 'Metadata Item',
					fields: [
						defineField({
							name: 'title',
							type: 'string',
							validation: (Rule) => Rule.required(),
						}),
						defineField({
							name: 'contentType',
							title: 'Content Type',
							type: 'string',
							options: {
								list: [
									{ title: 'Rich Text', value: 'richText' },
									{ title: 'Tags / Text List', value: 'list' },
								],
								layout: 'radio',
							},
							initialValue: 'richText',
							validation: (Rule) => Rule.required(),
						}),
						defineField({
							name: 'richText',
							title: 'Rich Text',
							type: 'portableTextSimple',
							hidden: ({ parent }) => parent?.contentType !== 'richText',
						}),
						defineField({
							name: 'list',
							title: 'Tags / Text List',
							type: 'array',
							of: [
								defineArrayMember({
									type: 'reference',
									to: [{ type: 'gTag' }],
								}),
								defineArrayMember({
									type: 'object',
									name: 'textItem',
									title: 'Text',
									fields: [
										defineField({
											name: 'text',
											type: 'string',
											validation: (Rule) => Rule.required(),
										}),
									],
									preview: { select: { title: 'text' } },
								}),
							],
							hidden: ({ parent }) => parent?.contentType !== 'list',
						}),
					],
					preview: {
						select: { title: 'title', contentType: 'contentType' },
						prepare({ title, contentType }) {
							return {
								title: title || 'Untitled',
								subtitle: contentType === 'list' ? 'Tags / Text' : 'Rich text',
							};
						},
					},
				}),
			],
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
			const tag = isLocale(language) ? LOCALE_SHORT_LABELS[language] : '';
			return {
				title: tag ? `[${tag}] ${title}` : title,
				subtitle: `[${pickLocalizedValue(categoryTitle) ?? '(no category)'}] — ${href ?? '/products/(no slug)'}`,
				media: mainImage?.image.asset || ImageIcon,
			};
		},
	},
});
