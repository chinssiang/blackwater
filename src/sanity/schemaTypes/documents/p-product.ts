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
import { ShopifyProductInput } from '@/sanity/schemaTypes/components/ShopifyProductInput';
import { apiVersion } from '@/sanity/env';

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
			name: 'shopify',
			title: 'Shopify',
			type: 'object',
			description:
				'Link this product to Shopify. When linked, price, availability and the purchase button come live from Shopify, and the manual price / sold-out / purchase-link fields below are only used as fallbacks.',
			options: { collapsible: true, collapsed: false },
			fields: [
				defineField({
					name: 'handle',
					title: 'Product handle',
					type: 'string',
					description:
						'The product handle from Shopify admin (the last part of the product URL, e.g. "waffle-knit-beanie"). Set it once — every language version of this product inherits it. Fill it in here only to point one language at a different Shopify product.',
					components: { input: ShopifyProductInput },
					validation: (Rule) =>
						Rule.custom((value) => {
							if (!value) return true;
							if (value !== value.trim())
								return 'Remove leading/trailing spaces';
							if (/\s/.test(value)) return 'Handles cannot contain spaces';
							return true;
						}),
				}),
			],
		}),
		defineField({
			name: 'price',
			type: 'string',
			description:
				'e.g. $1,299 or From $49/mo. Fallback only when a Shopify product is linked above.',
			// Required only while there's no Shopify link — once one exists the
			// live price is authoritative and this field is an unused fallback,
			// so demanding a value here would leave linked products permanently
			// un-publishable (or permanently warned at).
			//
			// "Linked" includes an inherited link: a translation with no handle of
			// its own still renders live commerce from its sibling's (see
			// shopifyHandleField in queries.ts). Checking only this document's own
			// handle would block every translation on a price string the site never
			// displays, which is why this reaches for the sibling.
			validation: (Rule) =>
				Rule.custom(async (value, context) => {
					if (value) return true;
					const doc = context.document as
						| { slug?: { current?: string }; shopify?: { handle?: string } }
						| undefined;
					if (doc?.shopify?.handle) return true;
					const slug = doc?.slug?.current;
					if (!slug) return 'Required';
					// Siblings are matched on slug, the same way the frontend query
					// resolves them.
					const inherited = await context
						.getClient({ apiVersion })
						.fetch<string | null>(
							`*[_type == "pProduct" && slug.current == $slug && defined(shopify.handle)][0].shopify.handle`,
							{ slug }
						);
					return inherited ? true : 'Required';
				}),
		}),
		defineField({
			name: 'purchaseLink',
			title: 'Purchase Link',
			type: 'url',
			description:
				'Overrides the Shopify product URL when set; required for products not linked to Shopify.',
		}),
		defineField({
			name: 'soldOut',
			title: 'Sold Out',
			type: 'boolean',
			initialValue: false,
			description:
				'When on, the purchase button becomes a disabled "Sold out" state and a "Notify when back in stock" form appears. Shopify-linked products get this automatically from live availability; the toggle stays as a manual override.',
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
			name: 'sizeChart',
			title: 'Size Chart',
			type: 'reference',
			to: [{ type: 'gSizeChart' }],
			description:
				'Adds a size guide on the product page, opening this chart in a dialog. Charts are shared, so several products can point at the same one.',
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
			soldOut: 'soldOut',
			shopifyHandle: 'shopify.handle',
		},
		prepare({
			title = 'Untitled',
			slug = {},
			language,
			categoryTitle,
			mainImage,
			soldOut,
			shopifyHandle,
		}: Record<string, any>) {
			const href = slug?.current
				? resolveHref({
						documentType: 'pProduct',
						slug: slug.current,
						locale: language as Locale,
					})
				: null;
			const tag = isLocale(language) ? LOCALE_SHORT_LABELS[language] : '';
			// The marker reports this document's *own* handle, because prepare()
			// only ever sees fields selected from this document — it cannot tell an
			// unlinked product from a translation inheriting a sibling's handle.
			// So absence is left unlabelled rather than captioned "not linked",
			// which would be wrong for every translation.
			return {
				title: tag ? `[${tag}] ${title}` : title,
				subtitle: `[${pickLocalizedValue(categoryTitle) ?? '(no category)'}] — ${href ?? '/products/(no slug)'}${soldOut ? ' · Sold out' : ''}${shopifyHandle ? ' · 🔗 Shopify' : ''}`,
				media: mainImage?.image.asset || ImageIcon,
			};
		},
	},
});
