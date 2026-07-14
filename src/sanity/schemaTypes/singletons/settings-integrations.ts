import { defineType } from 'sanity';

export const settingsIntegration = defineType({
	title: 'Integrations',
	name: 'settingsIntegration',
	type: 'document',
	// __experimental_actions: ['update', 'publish'], // disable for initial publish
	fields: [
		{
			title: 'Google Analytics (GA)',
			description: 'G-XXXXXXXXXX',
			name: 'gaIDs',
			type: 'array',
			of: [{ type: 'string' }],
		},
		{
			title: 'Google Tag Manager (GTM)',
			description: 'GTM-XXXXXXX',
			name: 'gtmIDs',
			type: 'array',
			of: [{ type: 'string' }],
		},
		{
			title: 'Klaviyo Company ID',
			description: 'Public site/company ID, e.g. WqYfWd',
			name: 'klaviyoCompanyId',
			type: 'string',
		},
		{
			title: 'Klaviyo Back-in-Stock List ID',
			description:
				'Single Klaviyo list that all "notify when back in stock" signups subscribe to. Product identity is captured per signup as event properties, so you segment by product in Klaviyo.',
			name: 'klaviyoBackInStockListId',
			type: 'string',
		},
	],
	preview: {
		prepare() {
			return {
				title: 'Integrations',
			};
		},
	},
});
