import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { DocumentsIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Dedicated size guide page at /size-guide. Holds title, intro, the shared
// footnote and SEO, plus the section grouping that drives the page: each section
// renders its title and one tab per referenced chart. Chart content itself is
// managed in Global → Size Charts (gSizeChart).
export const pSizeGuide = defineType({
	title: 'Size Guide Page',
	name: 'pSizeGuide',
	type: 'document',
	icon: DocumentsIcon,
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
									type: 'reference',
									to: [{ type: 'gSizeChart' }],
								}),
							],
							validation: (Rule) => [Rule.required().min(1), Rule.unique()],
						}),
					],
					preview: {
						select: {
							title: 'title',
							chart0: 'charts.0.title',
							chart1: 'charts.1.title',
							chart2: 'charts.2.title',
						},
						prepare({ title, chart0, chart1, chart2 }) {
							const names = [chart0, chart1, chart2].filter(Boolean);
							return {
								title: title || 'Untitled section',
								subtitle: names.join('  ·  ') || 'No charts',
							};
						},
					},
				}),
			],
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
