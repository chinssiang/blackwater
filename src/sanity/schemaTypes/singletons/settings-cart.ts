import { language } from '@/sanity/schemaTypes/objects/language';
import { LOCALE_SHORT_LABELS, isLocale } from '@/lib/i18n';
import { BasketIcon } from '@sanity/icons';
import { defineType, defineField, defineArrayMember } from 'sanity';

// Localized at the document level (listed in i18n-types.ts), so there is one
// Cart document per language — kept that way deliberately so each market can
// be merchandised with different recommendations. The heading is a plain
// string for the same reason. Products themselves are language-agnostic
// documents, so both Cart documents pick from the same product list.
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
				'Shown in the cart while it is empty, in this order. Leave empty to show nothing beyond the "your cart is empty" message. The site renders each product in the visitor’s language automatically.',
			// No language filter on the picker: products are language-agnostic
			// documents, so there is nothing to filter by. (The old filter matched
			// on a product `language` field that no longer exists — left in place
			// it would list every product to the English cart and none to zh_tw.)
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pProduct' }],
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
