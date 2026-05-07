import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { BookIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const pEvent = defineType({
	title: 'Event',
	name: 'pEvent',
	type: 'document',
	icon: BookIcon,
	fieldsets: [
		{
			name: 'trail',
			title: 'Trail / Multi-Station Route',
			description: 'Optional — only fill in for trail-style events with stations',
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
		defineField({
			name: 'eventDatetime',
			type: 'datetime',
			options: {
				dateFormat: 'MM/DD/YY',
			},
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'dateStatus',
			type: 'string',
			options: {
				list: [
					{ title: 'Confirmed', value: 'confirmed' },
					{ title: 'TBA', value: 'tba' },
					{ title: 'Postponed', value: 'postponed' },
				],
				layout: 'radio',
			},
			initialValue: 'confirmed',
		}),
		defineField({
			name: 'location',
			type: 'string',
			validation: (Rule) => Rule.required(),
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
						prepare({ title = 'Untitled' }) {
							return {
								title: title,
							};
						},
					},
				},
			],
			validation: (Rule) => Rule.unique(),
		}),
		defineField({
			name: 'teamAssignments',
			title: 'Team Assignments',
			type: 'array',
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
			description: 'Themed stops along the route — each with a quest, map link, and directions',
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
			eventDatetime: 'eventDatetime',
			categories: 'categories.0.title',
		},
		prepare({ title = 'Untitled', location, eventDatetime, categories }) {
			const categoryTitle = categories ?? '';
			const subtitle = `${location} - ${categoryTitle ? `[${categoryTitle}]` : ''}`;

			return {
				title: `${title} - ${new Date(eventDatetime).toLocaleDateString('en-US')}`,
				subtitle: subtitle,
				media: BookIcon,
			};
		},
	},
});
