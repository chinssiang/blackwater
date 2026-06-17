import { defineType, defineField } from 'sanity';

export const settingsConsent = defineType({
	title: 'Consent',
	name: 'settingsConsent',
	type: 'document',
	groups: [
		{ name: 'banner', title: 'Banner', default: true },
		{ name: 'categories', title: 'Categories' },
		{ name: 'policies', title: 'Policy Links' },
	],
	fields: [
		defineField({
			name: 'enabled',
			type: 'boolean',
			title: 'Show consent banner',
			description:
				'When off, the cookie consent banner is hidden site-wide. Leave on for GDPR/ePrivacy compliance.',
			initialValue: true,
			group: 'banner',
		}),
		defineField({
			name: 'bannerTitle',
			type: 'internationalizedArrayString',
			title: 'Banner Title',
			group: 'banner',
		}),
		defineField({
			name: 'bannerBody',
			type: 'internationalizedArrayText',
			title: 'Banner Body',
			description: 'Short explanation shown in the banner and preferences dialog.',
			group: 'banner',
		}),
		defineField({
			name: 'acceptAllLabel',
			type: 'internationalizedArrayString',
			title: 'Accept-All Button Label',
			group: 'banner',
		}),
		defineField({
			name: 'rejectAllLabel',
			type: 'internationalizedArrayString',
			title: 'Reject-All Button Label',
			group: 'banner',
		}),
		defineField({
			name: 'preferencesLabel',
			type: 'internationalizedArrayString',
			title: 'Manage-Preferences Button Label',
			group: 'banner',
		}),
		defineField({
			name: 'savePreferencesLabel',
			type: 'internationalizedArrayString',
			title: 'Save-Preferences Button Label',
			group: 'banner',
		}),
		defineField({
			name: 'necessaryTitle',
			type: 'internationalizedArrayString',
			title: 'Necessary — Title',
			group: 'categories',
		}),
		defineField({
			name: 'necessaryDescription',
			type: 'internationalizedArrayText',
			title: 'Necessary — Description',
			group: 'categories',
		}),
		defineField({
			name: 'analyticsTitle',
			type: 'internationalizedArrayString',
			title: 'Analytics — Title',
			description: 'Gates Google Analytics and Google Tag Manager.',
			group: 'categories',
		}),
		defineField({
			name: 'analyticsDescription',
			type: 'internationalizedArrayText',
			title: 'Analytics — Description',
			group: 'categories',
		}),
		defineField({
			name: 'marketingTitle',
			type: 'internationalizedArrayString',
			title: 'Marketing — Title',
			description: 'Gates Klaviyo onsite tracking.',
			group: 'categories',
		}),
		defineField({
			name: 'marketingDescription',
			type: 'internationalizedArrayText',
			title: 'Marketing — Description',
			group: 'categories',
		}),
		defineField({
			name: 'privacyPolicyLink',
			type: 'link',
			title: 'Privacy Policy Link',
			group: 'policies',
		}),
		defineField({
			name: 'cookiePolicyLink',
			type: 'link',
			title: 'Cookie Policy Link',
			group: 'policies',
		}),
	],
	preview: {
		prepare() {
			return { title: 'Consent' };
		},
	},
});
