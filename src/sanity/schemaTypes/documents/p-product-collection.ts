import { pickLocalizedValue } from '@/lib/i18n';
import { requireSomeValue } from '@/sanity/schemaTypes/documents/p-product';
import { slug, isUniqueAcrossType } from '@/sanity/schemaTypes/objects/slug';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { StackIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Field-level localized like pProduct: one collection document carries every
// language, so the product list is curated once and both locales render from
// it. Only title/description vary by language.
export const pProductCollection = defineType({
	title: 'Product Collection',
	name: 'pProductCollection',
	type: 'document',
	icon: StackIcon,
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
			name: 'description',
			type: 'internationalizedArrayText',
			description: 'Short description shown on the collection section',
		}),
		customImage({ title: 'Cover Image', name: 'coverImage' }),
		defineField({
			name: 'products',
			title: 'Products',
			type: 'array',
			// No language filter on the picker: products are language-agnostic
			// documents, so there is nothing to filter by.
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pProduct' }],
				}),
			],
			validation: (Rule) => Rule.unique(),
		}),
		// Field-level SEO, mirroring pProductCategory.
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
				'Overrides the meta description per language. Use no more than 160 characters. Falls back to Description.',
			fieldset: 'seo',
		}),
		defineField({
			name: 'shareGraphic',
			title: 'Share Graphic',
			type: 'image',
			description:
				'1200 x 630px. Falls back to Cover Image, then the site default.',
			fieldset: 'seo',
		}),
	],
	preview: {
		select: {
			title: 'title',
			slug: 'slug.current',
			media: 'coverImage.image.asset',
		},
		prepare({ title, slug, media }) {
			return {
				title: pickLocalizedValue(title) || 'Untitled',
				subtitle: slug ? `/${slug}` : '(no slug)',
				media: media || StackIcon,
			};
		},
	},
});
