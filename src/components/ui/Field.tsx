'use client';
import { useState } from 'react';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/Tooltip';
import { HiOutlineInformationCircle } from 'react-icons/hi2';
import { useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';

function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
	return (
		<fieldset
			data-slot="field-set"
			className={cn(
				'gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3 flex flex-col',
				className
			)}
			{...props}
		/>
	);
}

function FieldLegend({
	className,
	variant = 'legend',
	...props
}: React.ComponentProps<'legend'> & { variant?: 'legend' | 'label' }) {
	return (
		<legend
			data-slot="field-legend"
			data-variant={variant}
			className={cn(
				'mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base',
				className
			)}
			{...props}
		/>
	);
}

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

function FieldTitle({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="field-label"
			className={cn(
				'gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50 flex w-fit items-center leading-snug',
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

function FieldSeparator({
	children,
	className,
	...props
}: React.ComponentProps<'div'> & {
	children?: React.ReactNode;
}) {
	return (
		<div
			data-slot="field-separator"
			data-content={!!children}
			className={cn(
				'-my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2 relative',
				className
			)}
			{...props}
		>
			<Separator className="absolute inset-0 top-1/2" />
			{children && (
				<span
					className="text-muted-foreground px-2 bg-background relative mx-auto block w-fit"
					data-slot="field-separator-content"
				>
					{children}
				</span>
			)}
		</div>
	);
}

function FieldError({
	className,
	children,
	errors,
	...props
}: React.ComponentProps<'div'> & {
	errors?: Array<{ message?: string } | undefined>;
}) {
	const content = useMemo(() => {
		if (children) {
			return children;
		}

		if (!errors?.length) {
			return null;
		}

		const uniqueErrors = [
			...new Map(errors.map((error) => [error?.message, error])).values(),
		];

		if (uniqueErrors?.length == 1) {
			return uniqueErrors[0]?.message;
		}

		return (
			<ul className="ml-4 flex list-disc flex-col gap-1">
				{uniqueErrors.map(
					(error, index) =>
						error?.message && <li key={index}>{error.message}</li>
				)}
			</ul>
		);
	}, [children, errors]);

	if (!content) {
		return null;
	}

	return (
		<div
			role="alert"
			data-slot="field-error"
			className={cn('text-destructive text-sm font-normal', className)}
			{...props}
		>
			{content}
		</div>
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
				className="pointer-events-none z-[calc(var(--z-index-popover)+1)]"
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
				className="pointer-events-none z-[calc(var(--z-index-popover)+1)]"
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
	FieldError,
	FieldGroup,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldContent,
	FieldTitle,
	FieldStatus,
};
