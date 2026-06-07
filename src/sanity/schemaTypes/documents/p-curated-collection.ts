import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import customImage from '@/sanity/schemaTypes/objects/custom-image';
import { LOCALE_SHORT_LABELS, isLocale } from '@/lib/i18n';
import { StackIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

export const pCuratedCollection = defineType({
	title: 'Curated Collection',
	name: 'pCuratedCollection',
	type: 'document',
	icon: StackIcon,
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		slug(),
		language(),
		defineField({
			name: 'description',
			type: 'text',
			rows: 3,
			description: 'Short description shown on the collection section',
		}),
		customImage({ title: 'Cover Image', name: 'coverImage' }),
		defineField({
			name: 'products',
			title: 'Products',
			type: 'array',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pCurated' }],
					options: {
						filter: ({ document }) => {
							const lang = (document?.language as string) || 'en';
							return lang === 'en'
								? {
										filter: 'language == $lang || !defined(language)',
										params: { lang },
									}
								: {
										filter: 'language == $lang',
										params: { lang },
									};
						},
					},
				}),
			],
			validation: (Rule) => Rule.unique(),
		}),
		sharing(),
	],
	preview: {
		select: {
			title: 'title',
			slug: 'slug.current',
			language: 'language',
			media: 'coverImage.image.asset',
		},
		prepare({ title = 'Untitled', slug, language, media }) {
			const tag = isLocale(language) ? LOCALE_SHORT_LABELS[language] : '';
			return {
				title: tag ? `[${tag}] ${title}` : title,
				subtitle: slug ? `/${slug}` : '(no slug)',
				media: media || StackIcon,
			};
		},
	},
});
