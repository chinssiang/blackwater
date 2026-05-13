import { LinkIcon, MasterDetailIcon, WarningOutlineIcon } from '@sanity/icons';
import { resolveHref } from '@/lib/routes';
import { defineField, defineType } from 'sanity';
import { link } from '@/sanity/schemaTypes/objects/link';

export const navItem = defineType({
	title: 'Item',
	name: 'navItem',
	type: 'object',
	icon: LinkIcon,
	fields: [
		defineField({
			title: 'Title',
			name: 'title',
			type: 'string',
			validation: (Rule) => Rule.required(),
		}),
		link({
			showLabel: false,
			validation: (Rule: { required: () => unknown }) => Rule.required(),
		}),
	],
	preview: {
		select: {
			title: 'title',
			internalLinkSlug: 'link.internalLink.slug.current',
			internalLinkType: 'link.internalLink._type',
			href: 'link.href',
			linkType: 'link.linkType',
		},
		prepare({ title, internalLinkSlug, internalLinkType, href, linkType }) {
			if ((!linkType || !internalLinkType) && !href) {
				return {
					title: 'Empty Item',
					media: WarningOutlineIcon,
				};
			}
			const isExternal = linkType === 'external';

			return {
				title: title,
				subtitle: isExternal
					? href
					: resolveHref({
							documentType: internalLinkType,
							slug: internalLinkSlug,
						}),
				media: isExternal ? LinkIcon : MasterDetailIcon,
			};
		},
	},
});
