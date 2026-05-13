import { toPlainText } from '@portabletext/toolkit';
import { ThLargeIcon } from '@sanity/icons';
import type { PortableTextBlock } from '@portabletext/toolkit';
import { TablePreview, createTableInput } from './components';
import { definePlugin } from 'sanity';

type CellSchema = {
	name: string;
	type: string;
	marks?: unknown;
	[key: string]: unknown;
};

type TableSchemaConfig = {
	name?: string;
	title?: string;
	cellSchema: CellSchema;
};

type TableCell = { text?: PortableTextBlock[] };

const defaultPortableTextSchema: TableSchemaConfig = {
	name: 'portableTable',
	title: 'Portable Table',
	cellSchema: {
		name: 'portableTableBlock',
		type: 'block',
		marks: {
			decorators: [{ title: 'Strong', value: 'strong' }],
			annotations: [
				{
					name: 'link',
					type: 'link',
				},
			],
		},
	},
};

export const portableTable = definePlugin<TableSchemaConfig | void>((schema) => {
	const tableSchema = schema || defaultPortableTextSchema;
	const portableTextSchema = tableSchema.cellSchema;
	const WrappedTableInput = createTableInput(portableTextSchema);

	return {
		name: 'portableTablePlugin',
		schema: {
			types: [
				{
					title: 'Table Cell Body',
					name: 'tableCellBody',
					type: 'array',
					of: [portableTextSchema],
					options: {
						sortable: false,
					},
				},
				{
					title: 'Table Cell',
					name: 'tableCell',
					type: 'object',
					preview: {
						select: {
							text: 'text',
						},
						prepare({ text }: { text?: PortableTextBlock[] }) {
							return { title: toPlainText(text ?? []) };
						},
					},
					fields: [
						{
							name: 'text',
							type: 'tableCellBody',
						},
					],
				},
				{
					title: 'Table Row',
					name: 'tableRow',
					type: 'object',
					preview: {
						select: {
							cells: 'cells',
						},
						prepare({ cells = [] }: { cells?: TableCell[] }) {
							return {
								title: cells
									.map((cell) => toPlainText(cell.text ?? []))
									.join(', '),
							};
						},
					},
					fields: [
						{
							name: 'cells',
							type: 'array',
							of: [
								{
									type: 'tableCell',
								},
							],
							options: {
								sortable: false,
							},
						},
					],
				},
				{
					name: tableSchema.name ?? 'table',
					title: tableSchema.title ?? 'Table',
					type: 'object',
					icon: ThLargeIcon,
					components: {
						preview: TablePreview,
						input: WrappedTableInput,
					},
					preview: {
						select: {
							rows: 'rows',
						},
						prepare({ rows = [] }: { rows?: unknown[] }) {
							return { rows };
						},
					},
					fields: [
						{
							name: 'columnNumber',
							type: 'number',
							validation: (Rule: {
								required: () => { min: (n: number) => unknown };
							}) => Rule.required().min(1),
							initialValue: 3,
						},
						{
							name: 'rows',
							type: 'array',
							// TODO add a validation for column count
							of: [{ type: 'tableRow' }],
							initialValue: [],
							options: {
								sortable: false,
							},
						},
					],
				},
			],
		},
	};
});
