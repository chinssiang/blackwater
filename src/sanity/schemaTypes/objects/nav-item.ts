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
			description:
				"If left empty, the linked page's title (for internal links) or the URL (for external links) will be used.",
		}),
		link({
			showLabel: false,
			validation: (Rule: { required: () => unknown }) => Rule.required(),
		}),
	],
	preview: {
		select: {
			title: 'title',
			internalLinkTitle: 'link.internalLink.title',
			internalLinkSlug: 'link.internalLink.slug.current',
			internalLinkType: 'link.internalLink._type',
			href: 'link.href',
			linkType: 'link.linkType',
		},
		prepare({
			title,
			internalLinkTitle,
			internalLinkSlug,
			internalLinkType,
			href,
			linkType,
		}) {
			if ((!linkType || !internalLinkType) && !href) {
				return {
					title: 'Empty Item',
					media: WarningOutlineIcon,
				};
			}
			const isExternal = linkType === 'external';
			const displayTitle = title || internalLinkTitle || href;

			return {
				title: displayTitle,
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
