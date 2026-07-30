import {
	SIZE_MEASUREMENT_KEYS,
	SIZE_MEASUREMENT_OPTIONS,
	SIZE_MEASUREMENT_STUDIO_TITLES,
} from '@/lib/size-measurements';
import { isUniqueAcrossType, slug } from '@/sanity/schemaTypes/objects/slug';
import { ThLargeIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

// A single, globally reusable garment size chart. Deliberately NOT localized at
// the document level: the measurements are locale-invariant, so one document
// holds them once instead of forcing editors to retype every number per locale.
// The only translated field is the fit note, via an inline internationalized
// array. Referenced from pProduct and listed on the /size-guide page.
export const gSizeChart = defineType({
	title: 'Size Chart',
	name: 'gSizeChart',
	type: 'document',
	icon: ThLargeIcon,
	fields: [
		defineField({
			name: 'title',
			title: 'Title',
			description: 'Garment style name, e.g. 2605 HOOLE SS T',
			type: 'string',
			validation: (Rule) => Rule.required(),
		}),
		// Gives the chart a stable anchor on /size-guide so product pages can
		// deep-link to it. hideViewPage: the chart has no route of its own.
		// isUniqueAcrossType is required — this type has no `language` field, and
		// the default check short-circuits to "unique" for such types, which would
		// let two charts share a slug and collide as duplicate DOM ids.
		slug({ hideViewPage: true, isUnique: isUniqueAcrossType }),
		defineField({
			name: 'unit',
			title: 'Unit',
			type: 'string',
			options: {
				list: [
					{ title: 'Centimetres (cm)', value: 'cm' },
					{ title: 'Inches (in)', value: 'in' },
				],
				layout: 'radio',
			},
			initialValue: 'cm',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'columns',
			title: 'Measurement Columns',
			description:
				'Which measurements this chart lists. The row inputs below follow this selection. Columns always render in the standard order shown here, not in the order you tick them.',
			type: 'array',
			of: [defineArrayMember({ type: 'string' })],
			options: { list: SIZE_MEASUREMENT_OPTIONS },
			validation: (Rule) => [Rule.required().min(1), Rule.unique()],
		}),
		defineField({
			name: 'rows',
			title: 'Rows',
			description: 'One row per size, in the order they should appear.',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'object',
					name: 'sizeChartRow',
					title: 'Size Row',
					fields: [
						defineField({
							name: 'size',
							title: 'Size',
							description: 'e.g. S, M, L, XL, 2XL',
							type: 'string',
							validation: (Rule) => Rule.required(),
						}),
						// One numeric field per measurement in the vocabulary. Each is
						// hidden unless the parent document selected it in `columns`, so
						// editors only ever see the inputs this chart actually uses.
						...SIZE_MEASUREMENT_KEYS.map((key) =>
							defineField({
								name: key,
								title: SIZE_MEASUREMENT_STUDIO_TITLES[key],
								type: 'number',
								hidden: ({ document }) =>
									!(document?.columns as string[] | undefined)?.includes(key),
							})
						),
					],
					preview: {
						select: {
							size: 'size',
							...Object.fromEntries(
								SIZE_MEASUREMENT_KEYS.map((key) => [key, key])
							),
						},
						prepare(values: Record<string, unknown>) {
							const filled = SIZE_MEASUREMENT_KEYS.filter(
								(key) => typeof values[key] === 'number'
							).map(
								(key) => `${SIZE_MEASUREMENT_STUDIO_TITLES[key]} ${values[key]}`
							);
							return {
								title: (values.size as string) || 'Untitled size',
								subtitle: filled.join('  ·  ') || undefined,
							};
						},
					},
				}),
			],
			validation: (Rule) => Rule.required().min(1),
		}),
		defineField({
			name: 'note',
			title: 'Fit Note',
			description:
				'Optional note shown under this table, e.g. sizing-down advice.',
			type: 'internationalizedArrayText',
		}),
		defineField({
			name: 'order',
			title: 'Order',
			type: 'number',
			description: 'Lower numbers appear first on the size guide page.',
			initialValue: 0,
		}),
	],
	orderings: [
		{
			title: 'Order',
			name: 'orderAsc',
			by: [{ field: 'order', direction: 'asc' }],
		},
	],
	preview: {
		select: { title: 'title', columns: 'columns', rows: 'rows', unit: 'unit' },
		prepare({ title, columns, rows, unit }: Record<string, any>) {
			const sizes = Array.isArray(rows)
				? rows
						.map((row) => row?.size)
						.filter(Boolean)
						.join(' / ')
				: '';
			const count = Array.isArray(columns) ? columns.length : 0;
			return {
				title: title || 'Untitled size chart',
				subtitle:
					[
						sizes,
						`${count} measurement${count === 1 ? '' : 's'} (${unit || 'cm'})`,
					]
						.filter(Boolean)
						.join(' — ') || undefined,
				media: ThLargeIcon,
			};
		},
	},
});
