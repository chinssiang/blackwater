import { PinIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';
import { pickLocalizedValue } from '@/lib/i18n';

export const gLocation = defineType({
	title: 'Location',
	name: 'gLocation',
	type: 'document',
	icon: PinIcon,
	fields: [
		defineField({
			name: 'name',
			title: 'Name',
			type: 'internationalizedArrayString',
		}),
		defineField({
			name: 'slug',
			title: 'Slug',
			type: 'slug',
			options: {
				source: (doc) => pickLocalizedValue(doc.name) || '',
				maxLength: 96,
			},
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'mapLink',
			title: 'Map link',
			type: 'url',
			description: 'Google Maps URL for this location',
		}),
		defineField({
			name: 'address',
			title: 'Address',
			type: 'object',
			description:
				'Optional postal address. Emitted as a PostalAddress on Event structured data — improves event rich results and local discovery.',
			options: { collapsible: true, collapsed: true },
			fields: [
				defineField({
					name: 'streetAddress',
					type: 'string',
					title: 'Street Address',
				}),
				defineField({
					name: 'addressLocality',
					type: 'string',
					title: 'City / Locality',
				}),
				defineField({
					name: 'addressRegion',
					type: 'string',
					title: 'Region / State',
				}),
				defineField({
					name: 'postalCode',
					type: 'string',
					title: 'Postal Code',
				}),
				defineField({
					name: 'addressCountry',
					type: 'string',
					title: 'Country Code',
					description: 'ISO 3166-1 alpha-2, e.g. "TW".',
				}),
			],
		}),
		defineField({
			name: 'geo',
			title: 'Coordinates',
			type: 'object',
			description:
				'Optional latitude/longitude. Emitted as GeoCoordinates on Event structured data.',
			options: { collapsible: true, collapsed: true },
			fields: [
				defineField({ name: 'lat', type: 'number', title: 'Latitude' }),
				defineField({ name: 'lng', type: 'number', title: 'Longitude' }),
			],
		}),
	],
	preview: {
		select: {
			name: 'name',
		},
		prepare({ name }) {
			const zhName = Array.isArray(name)
				? name.find((entry) => entry?.language === 'zh_tw')?.value
				: undefined;
			return {
				title: pickLocalizedValue(name) || 'Untitled',
				subtitle: zhName || undefined,
				media: PinIcon,
			};
		},
	},
});
