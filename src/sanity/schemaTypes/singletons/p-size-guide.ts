import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { ThLargeIcon } from '@sanity/icons';
import { defineType } from 'sanity';

// Dedicated size guide page at /size-guide. Thin wrapper: holds title, intro,
// the shared footnote and SEO, and renders the full global gSizeChart set
// (ordered). Chart content is managed in Global → Size Charts (gSizeChart).
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
