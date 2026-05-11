import { defineField, defineType } from 'sanity';

export const eventStation = defineType({
	name: 'eventStation',
	title: 'Station',
	type: 'object',
	fields: [
		defineField({
			name: 'name',
			title: 'Station Name',
			type: 'string',
			description: 'e.g. Herbal, Sour, Fruity, Sweet',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'locationName',
			title: 'Location Name',
			type: 'string',
			description: "e.g. Da'an Forest Park (Exit 2)",
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'locationLink',
			title: 'Google Maps Link',
			type: 'url',
		}),
		defineField({
			name: 'distance',
			title: 'Distance',
			type: 'string',
			description: 'e.g. ~5km roundtrip',
		}),
		defineField({
			name: 'questTitle',
			title: 'Quest Title',
			type: 'string',
			description: 'e.g. Balance Task, Zest Selfie',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'questInstructions',
			title: 'Quest Instructions',
			type: 'text',
			rows: 3,
			description: 'What the runner must do to earn the card',
		}),
		defineField({
			name: 'directionsIn',
			title: 'Getting Here',
			type: 'text',
			rows: 3,
			description:
				'How to reach this station (from store or from previous stop)',
		}),
		defineField({
			name: 'directionsOut',
			title: 'Heading Out',
			type: 'text',
			rows: 3,
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
				title: name,
				subtitle: locationName,
			};
		},
	},
});
