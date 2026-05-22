import { LinkIcon, MasterDetailIcon, WarningOutlineIcon } from '@sanity/icons';
import { resolveHref } from '@/lib/routes';
import { defineField, defineType } from 'sanity';
import { link } from '@/sanity/schemaTypes/objects/link';
import { pickLocalizedValue } from '@/lib/i18n';

export const navItem = defineType({
	title: 'Item',
	name: 'navItem',
	type: 'object',
	icon: LinkIcon,
	fields: [
		defineField({
			title: 'Title',
			name: 'title',
			type: 'internationalizedArrayString',
			description: 'If left empty, the URL will be shown in the Studio preview.',
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
		prepare({
			title,
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
			const displayTitle = pickLocalizedValue(title) || href;

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
