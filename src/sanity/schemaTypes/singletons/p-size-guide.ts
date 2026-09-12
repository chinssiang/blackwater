import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { ThLargeIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Dedicated size guide page at /size-guide. Holds title, intro, the shared
// footnote and SEO, plus the section grouping that drives the page: each section
// renders its title and one tab per referenced chart. Chart content itself is
// managed in Global → Size Charts (gSizeChart).
export const pSizeGuide = defineType({
	title: 'Size Guide Page',
	name: 'pSizeGuide',
	type: 'document',
	icon: ThLargeIcon,
	fields: [
		{ name: 'title', type: 'string', validation: (Rule) => [Rule.required()] },
		slug({
			initialValue: { _type: 'slug', current: 'size-guide' },
			readOnly: true,
		}),
		language(),
		{
			name: 'intro',
			title: 'Intro',
			type: 'text',
			rows: 2,
			description: 'Optional short intro shown above the charts.',
		},
		defineField({
			name: 'sections',
			title: 'Sections',
			description:
				'Each section renders its title plus one tab per chart. Charts are managed in Global → Size Charts; a chart not listed in any section will not appear on this page.',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'object',
					name: 'sizeGuideSection',
					title: 'Section',
					fields: [
						defineField({
							name: 'title',
							title: 'Title',
							type: 'string',
							validation: (Rule) => Rule.required(),
						}),
						defineField({
							name: 'charts',
							title: 'Charts',
							description: 'Shown as tabs, in this order.',
							type: 'array',
							of: [
								defineArrayMember({
									type: 'object',
									name: 'sizeGuideTab',
									title: 'Tab',
									fields: [
										defineField({
											name: 'chart',
											title: 'Chart',
											type: 'reference',
											to: [{ type: 'gSizeChart' }],
											validation: (Rule) => Rule.required(),
										}),
										defineField({
											name: 'label',
											title: 'Tab Label',
											description:
												'Optional short label for the tab, e.g. "Hoole T" for the chart "2605 Hoole SS T". Defaults to the chart title. The sidebar always shows the full chart title.',
											type: 'string',
										}),
									],
									preview: {
										select: { label: 'label', chartTitle: 'chart.title' },
										prepare({ label, chartTitle }) {
											return {
												title: label || chartTitle || 'Untitled chart',
												subtitle: label && chartTitle ? chartTitle : undefined,
											};
										},
									},
								}),
							],
							validation: (Rule) => Rule.required().min(1),
						}),
					],
					preview: {
						select: {
							title: 'title',
							label0: 'charts.0.label',
							label1: 'charts.1.label',
							label2: 'charts.2.label',
							chart0: 'charts.0.chart.title',
							chart1: 'charts.1.chart.title',
							chart2: 'charts.2.chart.title',
						},
						prepare(values: Record<string, string | undefined>) {
							const names = [0, 1, 2]
								.map((i) => values[`label${i}`] || values[`chart${i}`])
								.filter(Boolean);
							return {
								title: values.title || 'Untitled section',
								subtitle: names.join('  ·  ') || 'No charts',
							};
						},
					},
				}),
			],
			// The page uses each chart's slug as a DOM id so product pages can
			// deep-link to it, so the same chart listed twice would emit duplicate
			// ids and the link would resolve to whichever came first. Rule.unique()
			// can't catch this: the members are objects, so the same chart with two
			// different labels is two distinct values.
			validation: (Rule) =>
				Rule.custom((sections: any[] | undefined) => {
					const seen = new Map<string, string>();
					for (const section of sections ?? []) {
						for (const tab of section?.charts ?? []) {
							const ref = tab?.chart?._ref;
							if (!ref) continue;
							const previous = seen.get(ref);
							if (previous) {
								return `The same chart is listed in both "${previous}" and "${
									section?.title || 'an untitled section'
								}". Each chart may only appear once — the page uses its slug as a DOM id.`;
							}
							seen.set(ref, section?.title || 'an untitled section');
						}
					}
					return true;
				}),
		}),
		{
			name: 'footnote',
			title: 'Footnote',
			type: 'text',
			rows: 3,
			description:
				'Shared note shown once at the bottom, e.g. measuring method and manufacturing tolerance.',
		},
		sharing(),
	],
	preview: {
		select: { title: 'title' },
		prepare({ title = 'Size Guide Page' }) {
			return { title };
		},
	},
});
