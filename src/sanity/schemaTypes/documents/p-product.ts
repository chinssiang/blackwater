import { pickLocalizedValue, DEFAULT_LOCALE } from '@/lib/i18n';
import { resolveHref } from '@/lib/routes';
import { slug, isUniqueAcrossType } from '@/sanity/schemaTypes/objects/slug';
import { StarIcon, ImageIcon } from '@sanity/icons';
import {
	defineArrayMember,
	defineField,
	defineType,
	type ValidationContext,
} from 'sanity';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { ShopifyProductInput } from '@/sanity/schemaTypes/components/ShopifyProductInput';

/**
 * One document per product: the handle on this document is the whole truth
 * about being Shopify-linked (the old per-language sibling inheritance is
 * gone — there are no siblings). Synchronous, so validators need no network.
 */
function linkedToShopify(context: ValidationContext): boolean {
	const doc = context.document as
		| { shopify?: { handle?: string } }
		| undefined;
	return Boolean(doc?.shopify?.handle);
}

/**
 * Required-ness for internationalizedArray fields: the plugin stores
 * `[{_key, language, value}]`, so `Rule.required()` passes on an array of
 * empty items. "Has at least one non-empty value" is the real requirement —
 * deliberately not "has English": zh-only products exist and simply stay
 * hidden from the locales they carry no copy for.
 */
export function requireSomeValue(value: unknown): true | string {
	const items = Array.isArray(value) ? value : [];
	return items.some(
		(item) =>
			item &&
			typeof item === 'object' &&
			'value' in item &&
			Boolean((item as { value?: unknown }).value)
	)
		? true
		: 'Required in at least one language';
}

export const pProduct = defineType({
	title: 'Product',
	name: 'pProduct',
	type: 'document',
	icon: StarIcon,
	fieldsets: [
		{
			name: 'seo',
			title: 'SEO + Social Sharing',
			options: { collapsible: true, collapsed: true },
		},
	],
	fields: [
		defineField({
			name: 'title',
			type: 'internationalizedArrayString',
			validation: (Rule) => Rule.custom(requireSomeValue),
		}),
		// isUniqueAcrossType, not the default: with no `language` field the
		// default check short-circuits to `true` and accepts every duplicate.
		slug({ isUnique: isUniqueAcrossType }),
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
				'Link this product to Shopify. When linked, price, availability and the Add to cart button come live from Shopify: the manual price and purchase link below are only fallbacks for when Shopify is unreachable, while the sold-out toggle stays a manual override.',
			options: { collapsible: true, collapsed: false },
			fields: [
				defineField({
					name: 'handle',
					title: 'Product handle',
					type: 'string',
					description:
						'The product handle from Shopify admin (the last part of the product URL, e.g. "waffle-knit-beanie"). One product, one handle — every language renders from it; localized prices come from Shopify Markets, not separate products.',
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
			validation: (Rule) => [
				Rule.custom((value, context) =>
					value || linkedToShopify(context) ? true : 'Required'
				),
				Rule.custom((value, context) =>
					value && linkedToShopify(context)
						? 'Not shown while Shopify is reachable — the live price is used instead. Kept as the fallback for when it is not.'
						: true
				).warning(),
			],
		}),
		defineField({
			name: 'purchaseLink',
			title: 'Purchase Link',
			type: 'url',
			description:
				'External buy link for products we do not sell through our own Shopify cart. Ignored once a Shopify product is linked above — the Add to cart button is shown instead — and only falls back to this link if Shopify is unreachable.',
			validation: (Rule) =>
				Rule.custom((value, context) =>
					value && linkedToShopify(context)
						? 'Not used while Shopify is reachable — shoppers get the Add to cart button instead. This link stays as the fallback for when it is not, including if the handle above stops resolving, so it is safe to leave in place.'
						: true
				).warning(),
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
			type: 'internationalizedArrayText',
			description: 'Short description shown on listing cards',
			validation: (Rule) =>
				Rule.custom((value: unknown) => {
					const long = (Array.isArray(value) ? value : []).some(
						(item) =>
							typeof (item as { value?: unknown })?.value === 'string' &&
							((item as { value: string }).value.length > 200)
					);
					return long ? 'Keep under 200 characters' : true;
				}).warning(),
		}),
		defineField({
			name: 'content',
			type: 'internationalizedArrayPortableTextSimple',
		}),
		defineField({
			name: 'whyUseIt',
			title: 'Why do we use it?',
			type: 'internationalizedArrayPortableTextSimple',
		}),
		defineField({
			name: 'whoIsItFor',
			title: 'Who is it for?',
			type: 'internationalizedArrayPortableTextSimple',
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
					type: 'internationalizedArrayPortableTextSimple',
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
									type: 'internationalizedArrayString',
									validation: (Rule) => Rule.custom(requireSomeValue),
								}),
							],
							preview: {
								select: { title: 'text' },
								prepare: ({ title }) => ({
									title: pickLocalizedValue(title) ?? 'Untitled',
								}),
							},
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
							type: 'internationalizedArrayString',
							validation: (Rule) => Rule.custom(requireSomeValue),
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
							type: 'internationalizedArrayPortableTextSimple',
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
											type: 'internationalizedArrayString',
											validation: (Rule) => Rule.custom(requireSomeValue),
										}),
									],
									preview: {
										select: { title: 'text' },
										prepare: ({ title }) => ({
											title: pickLocalizedValue(title) ?? 'Untitled',
										}),
									},
								}),
							],
							hidden: ({ parent }) => parent?.contentType !== 'list',
						}),
					],
					preview: {
						select: { title: 'title', contentType: 'contentType' },
						prepare({ title, contentType }) {
							return {
								title: pickLocalizedValue(title) || 'Untitled',
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
		// Field-level SEO, mirroring pProductCategory (which replaced the shared
		// `sharing()` object for the same reason: its metaTitle/metaDesc are plain
		// strings, which can't carry two languages on one document).
		defineField({
			name: 'disableIndex',
			title: 'Disable Index',
			type: 'boolean',
			description: 'Instruct search engines not to index or follow this page',
			initialValue: false,
			fieldset: 'seo',
		}),
		defineField({
			name: 'seoTitle',
			title: 'SEO Title',
			type: 'internationalizedArrayString',
			description: 'Overrides the meta title per language. Falls back to Title.',
			fieldset: 'seo',
		}),
		defineField({
			name: 'seoDescription',
			title: 'SEO Description',
			type: 'internationalizedArrayText',
			description:
				'Overrides the meta description per language. Use no more than 160 characters. Falls back to Excerpt.',
			fieldset: 'seo',
		}),
		defineField({
			name: 'shareGraphic',
			title: 'Share Graphic',
			type: 'image',
			description:
				'1200 x 630px. Falls back to Main Image, then the site default.',
			fieldset: 'seo',
		}),
	],
	preview: {
		select: {
			title: 'title',
			slug: 'slug',
			categoryTitle: 'categories.0.title',
			mainImage: 'mainImage',
			soldOut: 'soldOut',
			shopifyHandle: 'shopify.handle',
		},
		prepare({
			title,
			slug = {},
			categoryTitle,
			mainImage,
			soldOut,
			shopifyHandle,
		}: Record<string, any>) {
			const href = slug?.current
				? resolveHref({
						documentType: 'pProduct',
						slug: slug.current,
						locale: DEFAULT_LOCALE,
					})
				: null;
			// One document per product, so the handle here is the whole truth about
			// being Shopify-linked — no per-language sibling can carry it instead.
			return {
				title: pickLocalizedValue(title) || 'Untitled',
				subtitle: `[${pickLocalizedValue(categoryTitle) ?? '(no category)'}] — ${href ?? '/products/(no slug)'}${soldOut ? ' · Sold out' : ''}${shopifyHandle ? ' · 🔗 Shopify' : ''}`,
				media: mainImage?.image.asset || ImageIcon,
			};
		},
	},
});
