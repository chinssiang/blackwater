import sharing from '@/sanity/schemaTypes/objects/sharing';
import { slug } from '@/sanity/schemaTypes/objects/slug';
import { language } from '@/sanity/schemaTypes/objects/language';
import { StarIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

export const pProductIndex = defineType({
	title: 'Products',
	name: 'pProductIndex',
	type: 'document',
	icon: StarIcon,
	fields: [
		defineField({
			name: 'title',
			type: 'string',
			validation: (Rule) => [Rule.required()],
		}),
		slug({
			initialValue: { _type: 'slug', current: 'products' },
			readOnly: true,
		}),
		language(),
		defineField({
			name: 'subtitle',
			type: 'string',
			description: 'Tagline shown below the title',
		}),
		defineField({
			name: 'description',
			type: 'text',
			rows: 3,
			description: 'Hero banner tagline on dark background',
		}),
		defineField({
			name: 'categories',
			title: 'Categories',
			type: 'array',
			description:
				'Categories displayed on the index page, in order. If empty, all categories are shown alphabetically.',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pProductCategory' }],
				}),
			],
			validation: (Rule) => Rule.unique(),
		}),
		defineField({
			name: 'collections',
			title: 'Collections',
			type: 'array',
			description: 'Collections displayed on the index page, in order',
			of: [
				defineArrayMember({
					type: 'reference',
					to: [{ type: 'pProductCollection' }],
				}),
			],
			validation: (Rule) => Rule.unique(),
		}),
		defineField({
			name: 'allProducts',
			title: 'All Products Section',
			type: 'object',
			description:
				'Heading shown above the auto-generated grid of the 24 most recent products',
			fields: [
				defineField({
					name: 'title',
					type: 'string',
				}),
				defineField({
					name: 'description',
					type: 'text',
					rows: 3,
				}),
			],
		}),
		defineField({
			name: 'submissionEmail',
			title: 'Product Submission Email',
			type: 'string',
			description:
				'Recipient for the floating "submit a product" form on product pages. Leave empty to hide the button. Only needs to be set on the English document — translations fall back to it.',
			validation: (Rule) => Rule.email(),
		}),
		defineField({
			name: 'confirmationEmail',
			title: 'Submission Confirmation Email',
			type: 'object',
			description:
				'Email sent to the visitor after a successful product submission. Any field left empty falls back to the English document, then to built-in defaults.',
			options: { collapsible: true, collapsed: true },
			fields: [
				defineField({
					name: 'subject',
					title: 'Subject',
					type: 'string',
					description: 'Email subject line. Supports {{name}}.',
				}),
				defineField({
					name: 'heading',
					title: 'Heading',
					type: 'string',
					description:
						'Large heading inside the email, e.g. "Thanks, {{name}}!". Supports {{name}}.',
				}),
				defineField({
					name: 'message',
					title: 'Message',
					type: 'text',
					rows: 4,
					description:
						'Body text shown above the submitted details. Blank lines create new paragraphs. Supports {{name}}.',
				}),
				defineField({
					name: 'footer',
					title: 'Footer note',
					type: 'text',
					rows: 2,
					description:
						'Small print at the bottom, e.g. why the recipient got this email.',
				}),
				defineField({
					name: 'logo',
					title: 'Logo',
					type: 'image',
					description:
						'Shown at the top of the email, about 140px wide. Dark logo on transparent PNG recommended (the email background is light). Falls back to the site wordmark.',
					options: { accept: '.png,.jpg' },
				}),
			],
		}),
		sharing(),
	],
	preview: {
		select: { title: 'title' },
		prepare({ title = 'Untitled' }) {
			return { title };
		},
	},
});
