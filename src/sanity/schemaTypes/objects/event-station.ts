import { defineField, defineType } from 'sanity';
import { pickLocalizedValue, requireSomeValue } from '@/lib/i18n';
import customImage from './custom-image';

export const eventStation = defineType({
	name: 'eventStation',
	title: 'Station',
	type: 'object',
	fields: [
		defineField({
			name: 'name',
			title: 'Station Name',
			type: 'internationalizedArrayString',
			description: 'e.g. Herbal, Sour, Fruity, Sweet',
			validation: (Rule) => Rule.custom(requireSomeValue),
		}),
		defineField({
			name: 'locationName',
			title: 'Location Name',
			type: 'internationalizedArrayString',
			description: "e.g. Da'an Forest Park (Exit 2)",
			validation: (Rule) => Rule.custom(requireSomeValue),
		}),
		defineField({
			name: 'locationLink',
			title: 'Google Maps Link',
			type: 'url',
		}),
		defineField({
			name: 'distance',
			title: 'Distance',
			type: 'internationalizedArrayString',
			description: 'e.g. ~5km roundtrip',
		}),
		defineField({
			name: 'questTitle',
			title: 'Quest Title',
			type: 'internationalizedArrayString',
			description: 'e.g. Balance Task, Zest Selfie',
			validation: (Rule) => Rule.custom(requireSomeValue),
		}),
		defineField({
			name: 'questInstructions',
			title: 'Quest Instructions',
			type: 'internationalizedArrayText',
			description: 'What the runner must do to earn the card',
		}),
		customImage({
			name: 'questExampleImage',
			title: 'Quest Example Image',
			hasMobileOption: false,
			hasCaptionOption: false,
			hasCropOption: false,
			options: { collapsible: true, collapsed: true },
		}),
		defineField({
			name: 'directionsIn',
			title: 'Getting Here',
			type: 'internationalizedArrayText',
			description:
				'How to reach this station (from store or from previous stop)',
		}),
		defineField({
			name: 'directionsOut',
			title: 'Heading Out',
			type: 'internationalizedArrayText',
			description: 'How to leave this station (to next stop or back to store)',
		}),
	],
	preview: {
		select: {
			name: 'name',
			locationName: 'locationName',
		},
		prepare({ name, locationName }) {
			return {
				title: pickLocalizedValue(name) || 'Untitled',
				subtitle: pickLocalizedValue(locationName),
			};
		},
	},
});
