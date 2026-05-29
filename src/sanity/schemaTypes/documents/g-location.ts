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
	],
	preview: {
		select: {
			name: 'name',
			mapLink: 'mapLink',
		},
		prepare({ name, mapLink }) {
			return {
				title: pickLocalizedValue(name) || 'Untitled',
				subtitle: mapLink || undefined,
				media: PinIcon,
			};
		},
	},
});
