import { resolveHref } from '@/lib/routes';
import { defineField, defineType } from 'sanity';

export const settingsRedirect = defineType({
	name: 'settingsRedirect',
	title: 'Redirects',
	type: 'document',
	description: 'Redirect for next.config.js',
	fields: [
		defineField({
			title: 'Source',
			name: 'url',
			type: 'slug',
			validation: (Rule) => [Rule.required()],
			description: (
				<>
					Enter path (e.g. /blog/lorem-ipsum). Source path supports{' '}
					<a
						href="https://nextjs.org/docs/pages/api-reference/next-config-js/redirects#path-matching"
						target="_blank"
						rel="noopener noreferrer"
					>
						path matching
					</a>
					.
				</>
			),
		}),
		defineField({
			type: 'link',
			title: 'Destination',
			name: 'destination',
			validation: (Rule) => Rule.required(),
			options: { hideNewTab: true },
		}),
		defineField({
			name: 'permanent',
			type: 'boolean',
			initialValue: true,
		}),
	],
	preview: {
		select: {
			title: 'url.current',
			internalLinkSlug: 'destination.internalLink.slug.current',
			internalLinkType: 'destination.internalLink._type',
			href: 'destination.href',
			linkType: 'destination.linkType',
		},
		prepare({ title, linkType, internalLinkSlug, internalLinkType, href }) {
			const isExternal = linkType === 'external';
			return {
				title: `Source: ${title}`,
				subtitle: `Destination: ${
					isExternal
						? href
						: resolveHref({
								documentType: internalLinkType,
								slug: internalLinkSlug,
							})
				}`,
			};
		},
	},
});
