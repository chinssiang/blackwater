'use client';
import { useState } from 'react';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/Tooltip';
import { HiOutlineInformationCircle } from 'react-icons/hi2';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/Label';

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="field-group"
			className={cn(
				'data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4 group/field-group @container/field-group flex w-full flex-col',
				className
			)}
			{...props}
		/>
	);
}

const fieldVariants = cva(
	'data-[invalid=true]:text-destructive gap-2 group/field flex w-full',
	{
		variants: {
			orientation: {
				vertical: 'flex-col [&>*]:w-full [&>.sr-only]:w-auto',
				horizontal:
					'flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
				responsive:
					'flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto @md/field-group:[&>[data-slot=field-label]]:flex-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
			},
		},
		defaultVariants: {
			orientation: 'vertical',
		},
	}
);

function Field({
	className,
	orientation = 'vertical',
	...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
	return (
		<div
			role="group"
			data-slot="field"
			data-orientation={orientation}
			className={cn(fieldVariants({ orientation }), className)}
			{...props}
		/>
	);
}

function FieldContent({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="field-content"
			className={cn(
				'gap-2 group/field-content flex flex-1 flex-col leading-snug',
				className
			)}
			{...props}
		/>
	);
}

function FieldLabel({
	className,
	...props
}: React.ComponentProps<typeof Label>) {
	return (
		<Label
			data-slot="field-label"
			className={cn(
				'has-data-checked:bg-primary/5 has-data-checked:border-primary/30 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10 gap-1 group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-2.5 group/field-label peer/field-label flex w-fit leading-snug text-xs',
				'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col',
				className
			)}
			{...props}
		/>
	);
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
	return (
		<p
			data-slot="field-description"
			className={cn(
				'text-muted-foreground text-left text-sm [[data-variant=legend]+&]:-mt-1.5 leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance',
				'last:mt-0 nth-last-2:-mt-1',
				'[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
				className
			)}
			{...props}
		/>
	);
}

function FieldStatus({
	fieldState = {},
	isFocused,
	isShowErrorOnFocus = false,
	className,
}: {
	fieldState?: any;
	isFocused?: boolean;
	isShowErrorOnFocus?: boolean;
	className?: string;
}) {
	const showError = fieldState.invalid && !!fieldState.error;
	const [isTooltipTriggered, setIsTooltipTriggered] = useState(false);

	return isShowErrorOnFocus ? (
		<Tooltip open={(!!showError && isFocused) || isTooltipTriggered}>
			<TooltipTrigger
				className={cn('absolute top-1/2 right-2 -translate-y-1/2', className)}
				asChild
			>
				{showError && (
					<HiOutlineInformationCircle
						className="text-error h-5 w-5"
						onMouseEnter={() => setIsTooltipTriggered(true)}
						onMouseLeave={() => setIsTooltipTriggered(false)}
					/>
				)}
			</TooltipTrigger>
			<TooltipContent
				className="pointer-events-none z-[calc(var(--z-index-dialog)+1)]"
				align="end"
				sideOffset={-2}
			>
				<p>{fieldState.error?.message}</p>
			</TooltipContent>
		</Tooltip>
	) : (
		<Tooltip open={isTooltipTriggered}>
			<TooltipTrigger
				className={cn('absolute top-1/2 right-2 -translate-y-1/2', className)}
				asChild
			>
				{showError && (
					<HiOutlineInformationCircle
						className="text-error h-5 w-5"
						onMouseEnter={() => setIsTooltipTriggered(true)}
						onMouseLeave={() => setIsTooltipTriggered(false)}
						onClick={() => setIsTooltipTriggered((prev) => !prev)}
					/>
				)}
			</TooltipTrigger>
			<TooltipContent
				className="pointer-events-none z-[calc(var(--z-index-dialog)+1)]"
				align="end"
				sideOffset={-2}
			>
				<p>{fieldState.error?.message}</p>
			</TooltipContent>
		</Tooltip>
	);
}

export {
	Field,
	FieldLabel,
	FieldDescription,
	FieldGroup,
	FieldContent,
	FieldStatus,
};
