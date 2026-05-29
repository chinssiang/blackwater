import { ChevronDownIcon } from '@sanity/icons';
import { defineType } from 'sanity';
import { pickLocalizedValue } from '@/lib/i18n';

export const navDropdown = defineType({
	title: 'Dropdown',
	name: 'navDropdown',
	type: 'object',
	icon: ChevronDownIcon,
	fields: [
		{
			title: 'Title',
			name: 'title',
			type: 'internationalizedArrayString',
			description: 'Text to Display',
		},
		{
			title: 'Dropdown Items',
			name: 'dropdownItems',
			type: 'array',
			of: [{ type: 'navItem' }],
		},
	],
	preview: {
		select: {
			title: 'title',
		},
		prepare({ title }) {
			return {
				title: pickLocalizedValue(title),
				subtitle: 'Dropdown',
				media: ChevronDownIcon,
			};
		},
	},
});
