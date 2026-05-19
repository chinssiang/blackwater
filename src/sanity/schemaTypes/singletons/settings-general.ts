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
			type: 'string',
			title: 'Site Title',
			description: 'The name of your site, usually your company/brand name',
			group: 'identity',
			validation: (Rule) => Rule.required().min(2).max(80),
		}),
		defineField({
			name: 'siteDescription',
			type: 'text',
			rows: 3,
			title: 'Site Description',
			description:
				'1–3 sentences describing the site overall. Used as the Organization and WebSite description in structured data (JSON-LD).',
			group: 'identity',
			validation: (Rule) => Rule.max(300).warning('Keep under ~300 chars.'),
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
			description: '1200 x 630px in PNG, JPG, or GIF',
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
	],
	preview: {
		prepare() {
			return { title: 'General Settings' };
		},
	},
});
