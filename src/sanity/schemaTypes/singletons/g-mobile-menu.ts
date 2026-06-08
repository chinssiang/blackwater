import callToAction from '@/sanity/schemaTypes/objects/call-to-action';
import { MenuIcon } from '@sanity/icons';
import { defineType } from 'sanity';

export const gMobileMenu = defineType({
	title: 'Mobile Menu',
	name: 'gMobileMenu',
	type: 'document',
	icon: MenuIcon,
	fields: [
		{
			title: 'Primary Menu',
			name: 'primaryMenu',
			type: 'array',
			of: [{ type: 'navItem' }],
		},
		{
			title: 'Secondary Menu',
			name: 'secondaryMenu',
			type: 'array',
			of: [{ type: 'navItem' }],
		},
		{ ...callToAction({ name: 'cta' }), title: 'CTA (Get in touch)' },
	],
	preview: {
		prepare: () => ({
			title: 'Mobile Menu',
		}),
	},
});
