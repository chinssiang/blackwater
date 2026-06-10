import { MenuIcon } from '@sanity/icons';
import { defineType } from 'sanity';

export const gToolbar = defineType({
	title: 'Toolbar Settings',
	name: 'gToolbar',
	type: 'document',
	icon: MenuIcon,
	fields: [
		{
			title: 'Hide Toolbar (Mobile)',
			name: 'hideToolbar',
			description:
				'Hide the bottom mobile toolbar across the site. Collapses its reserved height so content fills the space.',
			type: 'boolean',
			initialValue: false,
		},
		{
			title: 'Toolbar Menu (Mobile)',
			name: 'toolbarMenu',
			type: 'reference',
			to: [{ type: 'settingsMenu' }],
		},
	],
	preview: {
		prepare: () => ({
			title: 'Toolbar Settings',
		}),
	},
});
