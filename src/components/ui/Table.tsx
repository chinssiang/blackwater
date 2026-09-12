'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

function Table({
	className,
	containerProps,
	...props
}: React.ComponentProps<'table'> & {
	/**
	 * Props for the scroll container. A table wide enough to overflow needs
	 * `tabIndex={0}` plus a `role`/label here, or keyboard users have no way to
	 * scroll to the clipped columns.
	 */
	containerProps?: React.ComponentProps<'div'>;
}) {
	return (
		<div
			data-slot="table-container"
			{...containerProps}
			className={cn(
				'relative w-full overflow-x-auto',
				containerProps?.className
			)}
		>
			<table
				data-slot="table"
				className={cn('w-full caption-bottom text-sm', className)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
	return (
		<thead
			data-slot="table-header"
			className={cn('[&_tr]:border-b', className)}
			{...props}
		/>
	);
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
	return (
		<tbody
			data-slot="table-body"
			className={cn('[&_tr:last-child]:border-0', className)}
			{...props}
		/>
	);
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
	return (
		<tfoot
			data-slot="table-footer"
			className={cn(
				'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
				className
			)}
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
	return (
		<tr
			data-slot="table-row"
			className={cn(
				'data-[state=selected]:bg-muted hover:[td] group',
				className
			)}
			{...props}
		/>
	);
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				'text-foreground h-16 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
				className
			)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				'py-4 lg:py-6 px-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] group-hover:text-background transition-colors empty:p-0',
				className
			)}
			{...props}
		/>
	);
}

function TableCaption({
	className,
	...props
}: React.ComponentProps<'caption'>) {
	return (
		<caption
			data-slot="table-caption"
			className={cn('text-muted-foreground mt-4 text-sm', className)}
			{...props}
		/>
	);
}

export {
	Table,
	TableHeader,
	TableBody,
	TableFooter,
	TableHead,
	TableRow,
	TableCell,
	TableCaption,
};
