import { pickLocalizedValue, requireSomeValue } from '@/lib/i18n';
import { slug, isUniqueAcrossType } from '@/sanity/schemaTypes/objects/slug';
import { seoFieldset, seoFields } from '@/sanity/schemaTypes/objects/seo-fields';
import { TagsIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const pEventCategory = defineType({
	title: 'Categories',
	name: 'pEventCategory',
	type: 'document',
	icon: TagsIcon,
	fieldsets: [
		seoFieldset,
	],
	fields: [
		defineField({
			name: 'title',
			title: 'Title',
			type: 'internationalizedArrayString',
			validation: (Rule) => Rule.custom(requireSomeValue),
		}),
		// isUniqueAcrossType, not the default: with no `language` field the
		// default check short-circuits to `true` and accepts every duplicate.
		slug({ isUnique: isUniqueAcrossType }),
		defineField({
			title: 'Category Color',
			name: 'categoryColor',
			type: 'reference',
			to: [{ type: 'settingsBrandColors' }],
		}),
		...seoFields(),
	],
	preview: {
		select: { title: 'title' },
		prepare: ({ title }) => ({
			title: pickLocalizedValue(title) || 'Untitled',
		}),
	},
});
