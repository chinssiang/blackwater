import { language } from '@/sanity/schemaTypes/objects/language';
import { defineType } from 'sanity';

export const gFooter = defineType({
	title: 'Footer Settings',
	name: 'gFooter',
	type: 'document',
	fields: [
		language(),
		{
			title: 'Footer Menus',
			name: 'menus',
			description: 'Each menu becomes a footer column. Manage entries in Global → Menus.',
			type: 'array',
			of: [{ type: 'reference', to: [{ type: 'settingsMenu' }] }],
			validation: (Rule) => Rule.max(6),
		},
		{
			title: 'Toolbar Menu (Mobile)',
			name: 'toolbarMenu',
			type: 'reference',
			to: [{ type: 'settingsMenu' }],
		},
		{
			title: 'Copyright',
			name: 'copyright',
			description:
				'Shown in the footer bottom row after the auto-generated “© {year}”. Line breaks are preserved.',
			type: 'text',
			rows: 2,
		},
	],
	preview: {
		prepare() {
			return {
				title: 'Footer Settings',
			};
		},
	},
});
