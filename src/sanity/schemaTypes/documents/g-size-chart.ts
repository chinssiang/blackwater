import { pickLocalizedValue } from '@/lib/i18n';
import { SIZE_UNIT_OPTIONS, formatRange } from '@/lib/size-measurements';
import { isUniqueAcrossType, slug } from '@/sanity/schemaTypes/objects/slug';
import { ThLargeIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

// A single, globally reusable garment size chart. Deliberately NOT localized at
// the document level: the measurements are locale-invariant, so one document
// holds them once instead of forcing editors to retype every number per locale.
// Only the text fields are translated, via inline internationalized arrays.
// Referenced from pProduct and listed on the /size-guide page.
//
// Authoring mirrors the rendered table: `sizes` are the columns, and each `rows`
// entry is one measurement — so the array order in the Studio is the row order
// on the page.
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
			title: 'Authoring Unit',
			description:
				'The unit the numbers below are entered in. The size guide page offers a cm/in toggle and converts automatically, so each measurement is only ever typed once.',
			type: 'string',
			options: { list: SIZE_UNIT_OPTIONS, layout: 'radio' },
			initialValue: 'cm',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'sizes',
			title: 'Sizes',
			description:
				'The columns of the table, in order — e.g. XS, S, M, L, XL, 2XL. Use a single entry like "One Size" for accessories.',
			type: 'array',
			of: [defineArrayMember({ type: 'string' })],
			validation: (Rule) => [Rule.required().min(1), Rule.unique()],
		}),
		defineField({
			name: 'rows',
			title: 'Measurements',
			description:
				'One entry per measurement, in the order they should appear as rows. Each holds one value per size listed above, and each value names its own size.',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'object',
					name: 'sizeChartMeasurement',
					title: 'Measurement',
					fields: [
						defineField({
							name: 'label',
							title: 'Label',
							description: 'e.g. Chest, Waist, Arm Length',
							type: 'internationalizedArrayString',
							validation: (Rule) => Rule.required(),
						}),
						defineField({
							name: 'values',
							title: 'Values',
							description:
								'One per size. Each names the size it belongs to, so the order here does not matter. Leave Max empty for a single value instead of a range.',
							type: 'array',
							of: [
								defineArrayMember({
									type: 'object',
									name: 'sizeChartValue',
									title: 'Value',
									fields: [
										// Named rather than positional on purpose: the page looks the
										// cell up by size, so inserting or reordering Sizes can never
										// silently shift a row's numbers under the wrong heading.
										defineField({
											name: 'size',
											title: 'Size',
											description: 'Must match one of the chart’s Sizes exactly.',
											type: 'string',
											validation: (Rule) => Rule.required(),
										}),
										defineField({
											name: 'min',
											title: 'Min',
											type: 'number',
											validation: (Rule) => Rule.required(),
										}),
										defineField({
											name: 'max',
											title: 'Max',
											description: 'Optional. Set to render a range, e.g. 34–36.',
											type: 'number',
											// A transposed pair would otherwise publish and render
											// backwards ("36–34") on the public size guide. Equality is
											// allowed — formatRange collapses max === min to the single
											// value, so the frontend explicitly supports it.
											validation: (Rule) =>
												Rule.custom((max, context) => {
													const min = (
														context.parent as { min?: number } | undefined
													)?.min;
													if (typeof max !== 'number' || typeof min !== 'number')
														return true;
													return max >= min || 'Max cannot be less than Min.';
												}),
										}),
									],
									preview: {
										select: { size: 'size', min: 'min', max: 'max' },
										prepare({ size, min, max }: Record<string, any>) {
											const value =
												typeof min === 'number'
													? formatRange(min, max, 'cm', 'cm')
													: 'No value';
											return {
												title: size ? `${size} — ${value}` : value,
											};
										},
									},
								}),
							],
						}),
					],
					// Carry the whole row, each cell tagged with its size, so it reads
					// "Chest — XS 34–36 · S 36–38 · M 38–40" without the editor opening it.
					// Tagging matters because the values order is arbitrary now: it need
					// not match the Sizes order the page renders in.
					preview: {
						select: { label: 'label', values: 'values' },
						prepare({ label, values }: Record<string, any>) {
							const cells = Array.isArray(values)
								? values.map((value) => {
										const shown =
											typeof value?.min === 'number'
												? formatRange(value.min, value.max, 'cm', 'cm')
												: '—';
										return value?.size ? `${value.size} ${shown}` : shown;
									})
								: [];
							return {
								title: pickLocalizedValue(label) || 'Untitled measurement',
								subtitle: cells.join('  ·  ') || 'No values',
							};
						},
					},
				}),
			],
			// Every measurement must cover exactly the chart's sizes — no gaps, no
			// strays, no repeats. Cells are matched to columns by name, so this is
			// what keeps a typo from quietly becoming an extra column of dashes, or a
			// forgotten cell from rendering as a blank measurement.
			validation: (Rule) =>
				Rule.required()
					.min(1)
					.custom((rows: any[] | undefined, context) => {
						// Drop blank entries (a just-added, still-empty size is a normal
						// draft state) — matching the frontend's narrowing. Diffing against
						// a raw '' would demand a value no cell can ever name, since each
						// cell's size is itself required.
						const sizes = (
							(context.document?.sizes as string[] | undefined) ?? []
						).filter(Boolean);
						if (!sizes.length) return true;

						for (const row of rows ?? []) {
							const name =
								pickLocalizedValue(row?.label) || 'the untitled measurement';
							const authored: string[] = (row?.values ?? [])
								.map((value: any) => value?.size)
								.filter(Boolean);

							const repeated = authored.find(
								(size, index) => authored.indexOf(size) !== index
							);
							if (repeated) {
								return `"${name}" has more than one value for ${repeated}.`;
							}

							const missing = sizes.filter((size) => !authored.includes(size));
							if (missing.length) {
								return `"${name}" is missing a value for ${missing.join(', ')}.`;
							}

							const unknown = authored.filter((size) => !sizes.includes(size));
							if (unknown.length) {
								return `"${name}" has a value for ${unknown.join(
									', '
								)}, which is not listed in Sizes.`;
							}
						}

						return true;
					}),
		}),
		defineField({
			name: 'note',
			title: 'Fit Note',
			description:
				'Optional note shown above this table, e.g. sizing-down advice or "One Size".',
			type: 'internationalizedArrayText',
		}),
	],
	preview: {
		select: { title: 'title', sizes: 'sizes', rows: 'rows', unit: 'unit' },
		prepare({ title, sizes, rows, unit }: Record<string, any>) {
			const sizeList = Array.isArray(sizes) ? sizes.filter(Boolean).join(' / ') : '';
			const count = Array.isArray(rows) ? rows.length : 0;
			return {
				title: title || 'Untitled size chart',
				subtitle:
					[
						sizeList,
						`${count} measurement${count === 1 ? '' : 's'} (${unit || 'cm'})`,
					]
						.filter(Boolean)
						.join(' — ') || undefined,
				media: ThLargeIcon,
			};
		},
	},
});
