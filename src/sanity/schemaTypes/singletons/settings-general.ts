import { defineType, defineField } from 'sanity';

export const settingsGeneral = defineType({
	title: 'General Settings',
	name: 'settingsGeneral',
	type: 'document',
	groups: [
		{ name: 'identity', title: 'Branding & Identity', default: true },
		{ name: 'sharing', title: 'Sharing & Favicon' },
		{ name: 'contact', title: 'Contact & Social' },
	],
	fields: [
		defineField({
			name: 'siteTitle',
			type: 'internationalizedArrayString',
			title: 'Site Title',
			description:
				'The name of your site, usually your company/brand name. Per language.',
			group: 'identity',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'siteDescription',
			type: 'internationalizedArrayText',
			title: 'Site Description',
			description:
				'1–3 sentences describing the site overall, per language. Used as the Organization and WebSite description in structured data (JSON-LD).',
			group: 'identity',
		}),
		defineField({
			name: 'alternateName',
			type: 'internationalizedArrayString',
			title: 'Alternate Name',
			description:
				'Other names the organization is known by, per language (e.g. 台北跑團). Used as Organization alternateName in structured data — helps AI/search match brand searches.',
			group: 'identity',
		}),
		defineField({
			name: 'areaServed',
			type: 'internationalizedArrayString',
			title: 'Area Served',
			description:
				'The place this organization primarily serves, e.g. "Taipei, Taiwan". Per language. Used as Organization areaServed in structured data.',
			group: 'identity',
		}),
		defineField({
			name: 'foundingDate',
			type: 'date',
			title: 'Founding Date',
			description:
				'When the organization was established. Used as Organization foundingDate in structured data.',
			group: 'identity',
		}),
		defineField({
			name: 'siteLogo',
			type: 'image',
			title: 'Site Logo',
			description:
				'Transparent PNG or SVG preferred. Used as the Organization logo in structured data.',
			group: 'identity',
			options: { accept: '.png,.svg,.jpg' },
		}),
		defineField({
			name: 'wordmarkLogo',
			type: 'image',
			title: 'Wordmark Logo',
			description:
				'Transparent PNG or SVG preferred. Used as the Organization logo in structured data.',
			group: 'identity',
			options: { accept: '.png,.svg,.jpg' },
		}),
		defineField({
			name: 'siteDesc',
			type: 'note',
			title: 'About SEO',
			description:
				'The meta title and description settings are located in the SEO + sharing section at the bottom of each page',
			group: 'sharing',
		}),
		defineField({
			name: 'shareGraphic',
			type: 'image',
			title: 'Share Graphic',
			description:
				'Default social share image (1200 x 630px in PNG, JPG, or GIF). Used as the fallback whenever a page has no Share Graphic of its own.',
			group: 'sharing',
			options: { accept: '.jpg,.png,.gif' },
		}),
		defineField({
			name: 'shareVideo',
			type: 'file',
			title: 'Share Video',
			description: '1200 x 630px in MP4',
			group: 'sharing',
			options: { accept: '.mp4' },
		}),
		defineField({
			name: 'favicon',
			type: 'image',
			title: 'Favicon',
			description: '256 x 256px in PNG',
			group: 'sharing',
			options: { accept: '.png' },
		}),
		defineField({
			name: 'faviconLight',
			type: 'image',
			title: 'Favicon (Dark Mode)',
			description:
				'For devices in dark mode, use a light color to create contrast with dark backgrounds.',
			group: 'sharing',
			options: { accept: '.png' },
		}),
		defineField({
			name: 'contactEmail',
			type: 'string',
			title: 'Contact Email',
			description:
				'Public-facing contact email. Used as Organization contactPoint in structured data.',
			group: 'contact',
			validation: (Rule) =>
				Rule.email().error('Must be a valid email address.'),
		}),
		defineField({
			name: 'socialLinks',
			type: 'array',
			title: 'Social Links',
			description: 'Listed in Organization.sameAs for structured data.',
			group: 'contact',
			of: [{ type: 'socialLink' }],
		}),
		defineField({
			name: 'address',
			type: 'object',
			title: 'Address',
			description:
				'Optional postal address. Emitted as Organization address (PostalAddress) in structured data — strengthens local/place signals.',
			group: 'contact',
			options: { collapsible: true, collapsed: true },
			fields: [
				defineField({ name: 'streetAddress', type: 'string', title: 'Street Address' }),
				defineField({ name: 'addressLocality', type: 'internationalizedArrayString', title: 'City / Locality' }),
				defineField({ name: 'addressRegion', type: 'internationalizedArrayString', title: 'Region / State' }),
				defineField({ name: 'postalCode', type: 'string', title: 'Postal Code' }),
				defineField({
					name: 'addressCountry',
					type: 'string',
					title: 'Country Code',
					description: 'ISO 3166-1 alpha-2, e.g. "TW".',
				}),
			],
		}),
	],
	preview: {
		prepare() {
			return { title: 'General Settings' };
		},
	},
});
