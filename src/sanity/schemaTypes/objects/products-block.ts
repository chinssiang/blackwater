import { TagIcon } from '@sanity/icons';
import { defineArrayMember, defineType, defineField } from 'sanity';

// Recommended-products page module: a small grid of product cards on pHome or
// pGeneral. Cards render Sanity's editorial mainImage and get their price from
// Shopify at render time (see ProductsBlock.tsx) -- the module itself stores no
// commerce data.
//
// Two sources. A hand-picked list is a one-off selection for this page; a
// collection reference follows pProductCollection, so re-merchandising the
// collection moves every block pointing at it. Unlike faqBlock's hand-picked
// arm, neither is per-locale: products are field-level localized, so one
// reference array serves both languages.

// Reads the `source` discriminant off the enclosing module. `parent`, not
// `document`: inside pageModules[] the document is the PAGE, so a predicate
// keyed off it would read the wrong object entirely. Shared by the `hidden` and
// `validation` of both source-dependent fields, which have to agree -- a field
// is exempt from validation on exactly the condition that hides it.
const sourceOf = (owner: { parent?: unknown }) =>
	(owner.parent as { source?: string } | undefined)?.source;

export const productsBlock = defineType({
	name: 'productsBlock',
	title: 'Products',
	type: 'object',
	icon: TagIcon,
	fields: [
		defineField({
			name: 'heading',
			type: 'string',
			title: 'Heading',
			description: 'Optional section heading, e.g. "What we’re wearing".',
		}),
		defineField({
			name: 'source',
			title: 'Products from',
			type: 'string',
			options: {
				list: [
					{ title: 'Hand-picked products', value: 'picked' },
					{ title: 'A collection', value: 'collection' },
				],
				layout: 'radio',
			},
			initialValue: 'picked',
			// Deliberately NOT required. productsBlockField treats a missing `source`
			// as the hand-picked arm, so a module written through the API or an
			// import renders correctly; requiring it here would call that same module
			// invalid and make its host page unpublishable over a radio the editor
			// never set. `initialValue` covers everything created in the Studio.
		}),
		defineField({
			name: 'products',
			title: 'Products',
			type: 'array',
			description:
				'Shown in this order. Products translated into neither this language nor English are skipped when the page renders.',
			// No language filter on the picker: products are language-agnostic
			// documents, so there is nothing to filter by. Locale visibility is
			// enforced in GROQ instead (visibleProducts).
			of: [
				defineArrayMember({ type: 'reference', to: [{ type: 'pProduct' }] }),
			],
			hidden: (owner) => sourceOf(owner) !== 'picked',
			validation: (Rule) => [
				// Unconditional, like gFaqList.questions: two references to the same
				// product would render the same card twice.
				Rule.unique(),
				Rule.custom(
					(value, context) =>
						sourceOf(context) !== 'picked' ||
						(Array.isArray(value) && value.length > 0) ||
						'Pick at least one product, or switch to a collection.'
				),
			],
		}),
		defineField({
			name: 'collection',
			title: 'Collection',
			type: 'reference',
			to: [{ type: 'pProductCollection' }],
			description:
				'Collections are managed in Products → Collections. Re-ordering the collection re-orders this block, and every other block pointing at it.',
			hidden: (owner) => sourceOf(owner) !== 'collection',
			// Conditional so a hidden field never blocks publishing -- only the one
			// the editor can actually see.
			validation: (Rule) =>
				Rule.custom(
					(value, context) =>
						sourceOf(context) !== 'collection' ||
						!!value ||
						'Pick a collection, or switch to hand-picked products.'
				),
		}),
		defineField({
			name: 'limit',
			title: 'How many',
			type: 'number',
			options: {
				list: [
					{ title: '2 products', value: 2 },
					{ title: '4 products', value: 4 },
					{ title: '6 products', value: 6 },
					{ title: '8 products', value: 8 },
				],
				layout: 'radio',
			},
			initialValue: 4,
			description:
				'8 is the ceiling. Card grids are the heaviest thing these pages render -- the /products index was cut to 8 + 4 after 58 cards put its Speed Index at 20.9s on mobile.',
		}),
		defineField({
			name: 'sectionAppearance',
			type: 'sectionAppearance',
		}),
	],
	preview: {
		select: {
			heading: 'heading',
			source: 'source',
			// `_ref`, not `collection.title`: pProductCollection.title is an
			// internationalizedArray, so it previews as an object, and an empty one
			// is still truthy.
			collectionRef: 'collection._ref',
			products: 'products',
		},
		prepare({ heading, source, collectionRef, products }) {
			const count = Array.isArray(products) ? products.length : 0;
			return {
				title: heading || 'Products',
				subtitle:
					source === 'collection'
						? collectionRef
							? 'From a collection'
							: 'No collection selected'
						: `${count} hand-picked product${count === 1 ? '' : 's'}`,
			};
		},
	},
});
