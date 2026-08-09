import { language } from '@/sanity/schemaTypes/objects/language';
import { LOCALE_SHORT_LABELS, isLocale } from '@/lib/i18n';
import { BasketIcon } from '@sanity/icons';
import { defineType, defineField, defineArrayMember } from 'sanity';

// Localized at the document level (listed in i18n-types.ts), so there is one
// Cart document per language. That is what lets the product picker below offer
// only same-language products — and it is why the heading is a plain string
// rather than an internationalizedArray.
export const settingsCart = defineType({
	title: 'Cart',
	name: 'settingsCart',
	type: 'document',
	icon: BasketIcon,
	fields: [
		language(),
		defineField({
			name: 'emptyHeading',
			type: 'string',
			title: 'Empty cart heading',
			description:
				'Shown above the suggestions when the cart is empty, e.g. "You might like".',
		}),
		defineField({
			name: 'recommendedProducts',
			type: 'array',
			title: 'Recommended products',
			description:
				'Shown in the cart while it is empty, in this order. Leave empty to show nothing beyond the "your cart is empty" message. Only products in this document’s language are listed.',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pProduct' }],
					options: {
						// Restrict picks to this document's language, so the cart never
						// has to undo an editor's language choice at query time. The
						// English branch also matches products with no language field
						// yet, which keeps un-migrated ones pickable.
						filter: ({ document }) => {
							const lang = (document?.language as string) || 'en';
							return lang === 'en'
								? {
										filter: 'language == $lang || !defined(language)',
										params: { lang },
									}
								: {
										filter: 'language == $lang',
										params: { lang },
									};
						},
					},
				}),
			],
			validation: (Rule) => Rule.unique().max(4),
		}),
	],
	preview: {
		select: { language: 'language' },
		prepare({ language }: { language?: string }) {
			const tag = isLocale(language) ? LOCALE_SHORT_LABELS[language] : '';
			return { title: tag ? `[${tag}] Cart` : 'Cart' };
		},
	},
});
