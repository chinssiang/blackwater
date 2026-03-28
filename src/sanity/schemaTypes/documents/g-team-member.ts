import { UsersIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const gTeamMember = defineType({
	title: 'Team Member',
	name: 'gTeamMember',
	type: 'document',
	icon: UsersIcon,
	fields: [
		defineField({
			name: 'name',
			title: 'Name',
			type: 'string',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'nickname',
			title: 'Nickname',
			type: 'string',
			description: 'Display name if different from full name',
		}),
		defineField({
			name: 'avatar',
			title: 'Avatar',
			type: 'image',
			options: {
				hotspot: true,
			},
		}),
		defineField({
			name: 'defaultRole',
			title: 'Default Role',
			type: 'reference',
			to: [{ type: 'pEventRole' }],
			description: 'Their most common role assignment',
		}),
		defineField({
			name: 'isActive',
			title: 'Active',
			type: 'boolean',
			initialValue: true,
			description:
				'Set to false to hide from assignment dropdowns without deleting history',
		}),
	],
	preview: {
		select: {
			name: 'name',
			nickname: 'nickname',
			avatar: 'avatar',
		},
		prepare({ name, nickname, avatar }) {
			return {
				title: nickname || name || 'Untitled',
				subtitle: nickname ? name : undefined,
				media: avatar || UsersIcon,
			};
		},
	},
});
