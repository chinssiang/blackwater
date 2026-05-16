import { EnvelopeIcon } from '@sanity/icons';
import { defineType } from 'sanity';

export const gNewsletter = defineType({
	title: 'Newsletter Form',
	name: 'gNewsletter',
	type: 'object',
	icon: EnvelopeIcon,
	fields: [
		{
			title: 'Klaviyo List ID',
			name: 'klaviyoListID',
			type: 'string',
			description: 'Your Klaviyo List to subscribe emails to',
			validation: (Rule) => Rule.required(),
		},
		{
			title: 'Heading',
			name: 'heading',
			type: 'string',
		},
		{
			title: 'Subheading',
			name: 'subheading',
			type: 'string',
		},
		{
			title: 'Submit Button Text',
			name: 'submitButtonText',
			type: 'string',
		},
		{
			title: 'Disclaimer / Footnote',
			name: 'disclaimer',
			type: 'portableTextSimple',
		},
		{
			title: 'Success Heading',
			name: 'successHeading',
			type: 'string',
		},
		{
			title: 'Success Body',
			name: 'successBody',
			type: 'string',
		},
		{
			title: 'Error Heading',
			name: 'errorHeading',
			type: 'string',
		},
		{
			title: 'Error Body',
			name: 'errorBody',
			type: 'string',
		},
	],
	preview: {
		prepare() {
			return {
				title: 'Newsletter Form',
			};
		},
	},
});
