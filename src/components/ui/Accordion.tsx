'use client';

import * as React from 'react';
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

// One panel open at a time unless the caller passes `multiple`; every item is
// collapsible. (Radix needed `type="single" collapsible` for the same thing.)
function Accordion({ ...props }: AccordionPrimitive.Root.Props) {
	return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn('border-b', className)}
			{...props}
		/>
	);
}

function AccordionTrigger({
	className,
	children,
	...props
}: AccordionPrimitive.Trigger.Props) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					'cursor-pointer focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:opacity-80 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-panel-open]>svg]:rotate-180',
					className
				)}
				{...props}
			>
				{children}
				<ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

// Open/close is a CSS height transition, the way Base UI documents it: the
// panel measures itself into --accordion-panel-height and is held at 0 on the
// frame it mounts (data-starting-style) and while it leaves (data-ending-style).
// Base UI waits for the transition to finish before unmounting the panel.
function AccordionContent({
	className,
	children,
	...props
}: AccordionPrimitive.Panel.Props) {
	return (
		<AccordionPrimitive.Panel
			data-slot="accordion-content"
			className="h-(--accordion-panel-height) overflow-hidden text-sm transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none"
			{...props}
		>
			<div className={cn('pt-0 pb-4', className)}>{children}</div>
		</AccordionPrimitive.Panel>
	);
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
