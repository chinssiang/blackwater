import { TagIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const pEventRole = defineType({
	title: 'Event Role',
	name: 'pEventRole',
	type: 'document',
	icon: TagIcon,
	fields: [
		defineField({
			name: 'title',
			title: 'Title',
			type: 'string',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'order',
			title: 'Order',
			type: 'number',
			description: 'Display order (lower numbers appear first)',
		}),
	],
	preview: {
		select: {
			title: 'title',
			order: 'order',
		},
		prepare({ title, order }) {
			return {
				title: title || 'Untitled',
				subtitle: order !== undefined ? `Order: ${order}` : undefined,
				media: TagIcon,
			};
		},
	},
});
