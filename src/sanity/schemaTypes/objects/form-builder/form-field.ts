import { defineField, defineType } from 'sanity';

export const formField = defineType({
	name: 'formField',
	title: 'Form Field',
	type: 'object',
	fields: [
		defineField({
			name: 'required',
			type: 'boolean',
			initialValue: false,
		}),
		defineField({
			name: 'fieldName',
			type: 'string',
			description:
				'Used to identify data during form processing, allowing the system to recognize which value belongs to which field upon submission. For example, in Salesforce Lead objects, you can refer to the object’s Field Name to correctly map and populate this field.',
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'fieldLabel',
			type: 'string',
		}),
		defineField({
			name: 'inputType',
			type: 'string',
			initialValue: 'text',
			options: {
				layout: 'dropdown',
				list: [
					{ value: 'text', title: 'Text' },
					{ value: 'email', title: 'Email' },
					{ value: 'tel', title: 'Phone number' },
					{ value: 'textarea', title: 'Text area' },
					{ value: 'select', title: 'Dropdown selection' },
					{ value: 'checkbox', title: 'Checkbox' },
					{ value: 'file', title: 'File upload' },
				],
			},
			validation: (Rule) => Rule.required(),
		}),
		defineField({
			name: 'placeholder',
			type: 'string',
			hidden: ({ parent }) =>
				parent.inputType === 'checkbox' || parent.inputType === 'file',
		}),
		defineField({
			name: 'selectOptions',
			title: 'Options',
			type: 'array',
			of: [
				{
					type: 'object',
					fields: [{ name: 'option', type: 'string' }],
				},
			],
			hidden: ({ parent }) => parent.inputType !== 'select',
		}),
		defineField({
			name: 'fieldWidth',
			type: 'string',
			initialValue: 'full',
			options: {
				layout: 'dropdown',
				list: [
					{ value: 'full', title: 'Full' },
					{ value: 'half', title: 'Half' },
				],
			},
		}),
	],
	preview: {
		select: {
			required: 'required',
			fieldLabel: 'fieldLabel',
			fieldName: 'fieldName',
			inputType: 'inputType',
		},
		prepare({ required, fieldLabel, fieldName, inputType }) {
			const statusText = required ? 'Required' : 'Optional';
			return {
				title: `${fieldName || fieldLabel}`,
				subtitle: `(${inputType}) — ${statusText}`,
			};
		},
	},
});
