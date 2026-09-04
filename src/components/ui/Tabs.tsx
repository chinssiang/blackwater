'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

// The site's pill tab, as a variant rather than a class string copied per
// route. It was spelled out verbatim in /size-guide and again in /events, and
// the two had already drifted on padding and type scale with nothing recording
// whether that was deliberate — so a restyle of the active fill or the focus
// ring would have landed on one page and not the other. `cva` here mirrors
// `buttonVariants`, which already establishes the pattern for exactly this.
const tabsTriggerVariants = cva(
	'cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				// Unstyled, as this primitive shipped: the default stays a bare
				// passthrough so existing call sites are unaffected.
				default: '',
				pill: 'border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:hover:bg-foreground/5 rounded-full border uppercase whitespace-nowrap data-[state=inactive]:bg-transparent',
			},
			size: {
				default: '',
				sm: 't-l-2 px-2.5 py-1.5',
				md: 't-l-1 px-3.5 py-1.5',
			},
		},
		defaultVariants: { variant: 'default', size: 'default' },
	}
);

function Tabs({ ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

function TabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn('flex', className)}
			{...props}
		/>
	);
}

function TabsTrigger({
	className,
	variant,
	size,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> &
	VariantProps<typeof tabsTriggerVariants>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(tabsTriggerVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn('outline-none', className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsTriggerVariants };
