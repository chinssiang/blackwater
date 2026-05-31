import { pickLocalizedValue } from '@/lib/i18n';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { TagsIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const pEventStatus = defineType({
	title: 'Status',
	name: 'pEventStatus',
	type: 'document',
	icon: TagsIcon,
	fields: [
		defineField({ name: 'title', title: 'Title', type: 'internationalizedArrayString' }),
		slug(),
		{
			title: 'Status text color',
			name: 'statusTextColor',
			type: 'reference',
			to: [{ type: 'settingsBrandColors' }],
		},
		{
			title: 'Status background color',
			name: 'statusBgColor',
			type: 'reference',
			to: [{ type: 'settingsBrandColors' }],
		},
	],
	preview: {
		select: {
			title: 'title',
		},
		prepare: ({ title }) => ({
			title: pickLocalizedValue(title) || 'Untitled',
		}),
	},
});
