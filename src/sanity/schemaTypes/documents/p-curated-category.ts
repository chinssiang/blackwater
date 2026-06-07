import { pickLocalizedValue } from '@/lib/i18n';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { TagsIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const pCuratedCategory = defineType({
	title: 'Curated Category',
	name: 'pCuratedCategory',
	type: 'document',
	icon: TagsIcon,
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
			title: 'Title',
			type: 'internationalizedArrayString',
		}),
		defineField({
			name: 'description',
			title: 'Description',
			type: 'internationalizedArrayText',
		}),
		slug(),
		customImage({
			title: 'Cover Image',
			name: 'coverImage',
			hasMobileOption: false,
			hasCaptionOption: false,
		}),
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
			description: '1200 x 630px. Falls back to Cover Image, then the site default.',
			fieldset: 'seo',
		}),
	],
	preview: {
		select: { title: 'title', description: 'description' },
		prepare: ({ title, description }) => {
			return {
				title: pickLocalizedValue(title) || 'Untitled',
				subtitle: pickLocalizedValue(description),
			};
		},
	},
});
