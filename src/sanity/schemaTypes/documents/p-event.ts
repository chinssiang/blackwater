import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { pickLocalizedValue } from '@/lib/i18n';
import { BookIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';
import { ViewPageField } from '@/sanity/schemaTypes/components/ViewPageField';
import '@/sanity/schemaTypes/view-page-field-types';

export const pEvent = defineType({
	title: 'Event',
	name: 'pEvent',
	type: 'document',
	icon: BookIcon,
	fieldsets: [
		{
			name: 'trail',
			title: 'Route / Multi-Station',
			description:
				'Optional — only fill in for multi-station events with stations',
			options: { collapsible: true, collapsed: true },
		},
	],
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		defineField({ name: 'subtitle', type: 'string' }),
		slug(),
		language(),
		defineField({
			name: 'format',
			title: 'Event format',
			type: 'string',
			options: {
				list: [
					{ title: 'Single location', value: 'single' },
					{ title: 'Multi-location', value: 'multi-location' },
				],
				layout: 'radio',
			},
			initialValue: 'single',
		}),
		customImage({
			name: 'heroImage',
			title: 'Hero image',
			hasMobileOption: true,
			hasCaptionOption: false,
			hasCropOption: true,
			options: { collapsible: true, collapsed: true },
		}),
		defineField({
			name: 'eventDatetime',
			type: 'datetime',
			options: {
				dateFormat: 'MM/DD/YY',
			},
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'endDatetime',
			title: 'End date & time',
			type: 'datetime',
			description:
				'Optional. When the event finishes — used as Event endDate in structured data (required for some rich results).',
			options: { dateFormat: 'MM/DD/YY' },
			validation: (Rule) =>
				Rule.min(Rule.valueOfField('eventDatetime')).warning(
					'End time should be after the start time.'
				),
		}),
		defineField({
			name: 'dateStatus',
			type: 'string',
			options: {
				list: [
					{ title: 'Confirmed', value: 'confirmed' },
					{ title: 'TBA', value: 'tba' },
					{ title: 'Postponed', value: 'postponed' },
					{ title: 'Cancelled', value: 'cancelled' },
				],
				layout: 'radio',
			},
			initialValue: 'confirmed',
		}),
		defineField({
			name: 'eventType',
			title: 'Event type',
			type: 'string',
			description: 'Used as a keyword in structured data.',
			options: {
				list: [
					{ title: 'Group run', value: 'group-run' },
					{ title: 'Race', value: 'race' },
					{ title: 'Social', value: 'social' },
					{ title: 'Trail', value: 'trail' },
				],
			},
		}),
		defineField({
			name: 'distanceKm',
			title: 'Distance (km)',
			type: 'number',
			description: 'Optional. Approximate route distance in kilometres.',
		}),
		defineField({
			name: 'isFree',
			title: 'Free to attend',
			type: 'boolean',
			description:
				'Used as isAccessibleForFree in structured data. Leave unset if unknown.',
		}),
		defineField({
			name: 'excerpt',
			title: 'Excerpt',
			type: 'text',
			rows: 2,
			description:
				'Short one-line summary (≤160 chars) used in listings and as a fallback structured-data description.',
			validation: (Rule) => Rule.max(160).warning('Keep under ~160 chars.'),
		}),
		defineField({
			name: 'locationRef',
			title: 'Location (reference)',
			type: 'reference',
			to: [{ type: 'gLocation' }],
		}),
		defineField({
			name: 'location',
			type: 'string',
			validation: (Rule) =>
				Rule.custom((value, context) => {
					const hasRef = !!(context.document as any)?.locationRef;
					if (!value && !hasRef) {
						return 'Location is required when no location reference is selected';
					}
					return true;
				}),
		}),
		defineField({
			name: 'locationLink',
			type: 'url',
		}),

		defineField({
			name: 'categories',
			type: 'array',
			of: [
				{
					type: 'reference',
					to: { type: 'pEventCategory' },
				},
			],
			validation: (Rule) => Rule.unique(),
		}),
		defineField({
			name: 'statusList',
			type: 'array',
			of: [
				{
					name: 'statusItem',
					type: 'object',
					fields: [
						{
							title: 'Status',
							name: 'eventStatus',
							type: 'reference',
							to: { type: 'pEventStatus' },
						},
						{
							name: 'link',
							type: 'link',
						},
					],
					preview: {
						select: {
							title: 'eventStatus.title',
						},
						prepare({ title }) {
							return {
								title: pickLocalizedValue(title) || 'Untitled',
							};
						},
					},
				},
			],
			validation: (Rule) => Rule.unique(),
		}),
		defineField({
			name: 'highlights',
			title: 'Highlights ("Good to know")',
			type: 'array',
			description:
				'Short label/value details shown in the left column — e.g. "Dress code: smart casual", "Capacity: 20", "Fee: $20".',
			of: [
				{
					type: 'object',
					fields: [
						defineField({
							name: 'label',
							type: 'string',
							validation: (Rule) => Rule.required(),
						}),
						defineField({
							name: 'value',
							type: 'string',
							validation: (Rule) => Rule.required(),
						}),
					],
					preview: {
						select: { title: 'label', subtitle: 'value' },
					},
				},
			],
			hidden: ({ document }) => (document as any)?.format !== 'single',
		}),
		defineField({
			name: 'teamAssignments',
			title: 'Team Assignments',
			type: 'array',
			components: { field: ViewPageField },
			options: { viewPageUrl: '/events-crew' },
			of: [
				{
					name: 'assignment',
					type: 'object',
					fields: [
						defineField({
							name: 'role',
							title: 'Role',
							type: 'reference',
							to: [{ type: 'pEventRole' }],
							validation: (Rule) => Rule.required(),
						}),
						defineField({
							name: 'group',
							title: 'Group',
							type: 'string',
							description: 'Optional group letter (A, B, C, D)',
						}),
						defineField({
							name: 'members',
							title: 'Members',
							type: 'array',
							of: [
								{
									type: 'reference',
									to: [{ type: 'gTeamMember' }],
								},
							],
							validation: (Rule) => Rule.required().min(1),
						}),
						defineField({
							name: 'note',
							title: 'Note',
							type: 'string',
							description: 'Optional inline note, e.g. "看當天人數"',
						}),
					],
					preview: {
						select: {
							roleTitle: 'role.title',
							group: 'group',
							member0: 'members.0.nickname',
							member0Name: 'members.0.name',
							member1: 'members.1.nickname',
							member1Name: 'members.1.name',
							member2: 'members.2.nickname',
							member2Name: 'members.2.name',
						},
						prepare({
							roleTitle,
							group,
							member0,
							member0Name,
							member1,
							member1Name,
							member2,
							member2Name,
						}) {
							const title = group
								? `${roleTitle || 'Role'} ${group} 組`
								: roleTitle || 'Role';
							const members = [
								member0 || member0Name,
								member1 || member1Name,
								member2 || member2Name,
							].filter(Boolean);
							const subtitle =
								members.length > 0 ? members.join(', ') : 'No members';
							return { title, subtitle };
						},
					},
				},
			],
		}),
		defineField({
			name: 'teamNotes',
			title: 'Team Notes',
			type: 'text',
			rows: 2,
			description: 'Event-level notes, e.g. OOO status',
		}),
		defineField({
			name: 'startEndLocation',
			title: 'Start & End Location',
			type: 'object',
			fieldset: 'trail',
			description: 'The store or meeting point where runners start and finish',
			hidden: ({ document }) => (document as any)?.format !== 'multi-location',
			fields: [
				defineField({ name: 'name', type: 'string', title: 'Name' }),
				defineField({ name: 'link', type: 'url', title: 'Google Maps Link' }),
			],
		}),
		defineField({
			name: 'stations',
			title: 'Stations',
			type: 'array',
			fieldset: 'trail',
			of: [{ type: 'eventStation' }],
			description:
				'Themed stops along the route — each with a quest, map link, and directions',
			hidden: ({ document }) => (document as any)?.format !== 'multi-location',
		}),
		defineField({
			name: 'content',
			type: 'portableText',
		}),
		sharing(),
	],
	preview: {
		select: {
			title: 'title',
			location: 'location',
			locationRefName: 'locationRef.name.0.value',
			eventDatetime: 'eventDatetime',
			categories: 'categories.0.title',
		},
		prepare({
			title = 'Untitled',
			location,
			locationRefName,
			eventDatetime,
			categories,
		}) {
			const categoryTitle = categories ?? '';
			const locationName = location || locationRefName || '';
			const subtitle = `${locationName} - ${categoryTitle ? `[${categoryTitle}]` : ''}`;

			return {
				title: `${title} - ${new Date(eventDatetime).toLocaleDateString('en-US')}`,
				subtitle: subtitle,
				media: BookIcon,
			};
		},
	},
});
