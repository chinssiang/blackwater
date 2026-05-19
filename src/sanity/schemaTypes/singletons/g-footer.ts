import { language } from '@/sanity/schemaTypes/objects/language';
import { defineType } from 'sanity';

export const gFooter = defineType({
	title: 'Footer Settings',
	name: 'gFooter',
	type: 'document',
	fields: [
		language(),
		{
			name: 'menu',
			type: 'reference',
			to: [{ type: 'settingsMenu' }],
		},
		{
			title: 'Legal menu',
			name: 'menuLegal',
			type: 'reference',
			to: [{ type: 'settingsMenu' }],
		},
		{
			title: 'Toolbar Menu (Mobile)',
			name: 'toolbarMenu',
			type: 'reference',
			to: [{ type: 'settingsMenu' }],
		},
		{
			title: 'Note',
			name: 'note',
			type: 'string',
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
