import { LinkObject } from '@/sanity/schemaTypes/components/LinkObject';
import { LinkIcon, MasterDetailIcon, WarningOutlineIcon } from '@sanity/icons';
import { resolveHref } from '@/lib/routes';
import { defineField, defineType } from 'sanity';

type LinkFactoryArgs = {
	title?: string;
	name?: string;
	showLabel?: boolean;
	[key: string]: unknown;
};

export function link({
	title,
	name,
	showLabel = true,
	...props
}: LinkFactoryArgs = {}): any {
	return defineType({
		title: title || 'Link',
		name: name || 'link',
		type: 'object',
		icon: LinkIcon,
		fields: [
			...(showLabel
				? [
						defineField({
							name: 'label',
							title: 'Label',
							type: 'internationalizedArrayString',
						}),
					]
				: []),
			defineField({
				name: 'href',
				type: 'string',
				title: 'URL',
			}),
			defineField({
				name: 'internalLink',
				title: 'Internal Page',
				type: 'reference',
				to: [
					{ type: 'pHome' },
					{ type: 'pGeneral' },
					{ type: 'pContact' },
					{ type: 'pCuratedIndex' },
					{ type: 'pCurated' },
					{ type: 'pCuratedCategory' },
					{ type: 'pCuratedCollection' },
					{ type: 'pEvents' },
					{ type: 'pEvent' },
				],
				hidden: true,
			}),
			defineField({
				name: 'linkType',
				type: 'string',
				options: {
					list: [
						{ title: 'Internal Page', value: 'internal' },
						{ title: 'External URL', value: 'external' },
					],
				},
				initialValue: 'internal',
				hidden: true,
			}),
			defineField({
				title: 'Open in new tab',
				name: 'isNewTab',
				type: 'boolean',
				initialValue: false,
			}),
		],
		components: {
			input: LinkObject,
		},
		preview: {
			select: {
				label: 'label',
				internalLinkSlug: 'internalLink.slug.current',
				internalLinkType: 'internalLink._type',
				href: 'href',
				linkType: 'linkType',
			},
			prepare({ label, internalLinkSlug, internalLinkType, href, linkType }) {
				if ((!linkType || !internalLinkType) && !href) {
					return {
						title: 'Empty Item',
						media: WarningOutlineIcon,
					};
				}
				const isExternal = linkType === 'external';
				const labelText = Array.isArray(label)
					? label.find((entry: { _key?: string; value?: string }) => entry._key === 'en')?.value ||
						label[0]?.value ||
						undefined
					: label;

				return {
					title: labelText,
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
		...props,
	});
}
