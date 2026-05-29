import formBuilder from '@/sanity/schemaTypes/objects/form-builder';
import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { BookIcon } from '@sanity/icons';
import { defineType } from 'sanity';

export const pContact = defineType({
	title: 'Contact Page',
	name: 'pContact',
	type: 'document',
	icon: BookIcon,
	fields: [
		{ name: 'title', type: 'string', validation: (Rule) => [Rule.required()] },
		slug(),
		language(),
		{
			name: 'description',
			type: 'text',
			rows: 3,
		},
		{
			title: 'Contact Form',
			name: 'contactForm',
			type: 'object',
			fields: [
				{
					name: 'formTitle',
					type: 'portableTextSimple',
				},
				formBuilder(),
				{
					name: 'successMessage',
					type: 'string',
				},
				{
					name: 'errorMessage',
					type: 'string',
				},
				{
					name: 'sendToEmail',
					type: 'string',
				},
				{
					name: 'emailSubject',
					type: 'string',
				},
				{
					title: 'Form Failure Notification Email',
					name: 'formFailureNotificationEmail',
					description:
						'A failure notification is sent when the form fails to submit. The notification includes all information that users have submitted. Use comma to separate emails.',
					type: 'string',
				},
			],
		},
		{
			name: 'legalConsent',
			type: 'portableTextSimple',
		},
		sharing(),
	],
});
