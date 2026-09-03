'use client';

import * as React from 'react';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

import { cn } from '@/lib/utils';

function Tabs({ ...props }: TabsPrimitive.Root.Props) {
	return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

// `activateOnFocus` defaults on: the arrow keys switch tabs as they move focus,
// which is what the Radix version did. Base UI's own default waits for
// Enter/Space.
function TabsList({
	className,
	activateOnFocus = true,
	...props
}: TabsPrimitive.List.Props) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			activateOnFocus={activateOnFocus}
			className={cn('flex', className)}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(
				'cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground disabled:pointer-events-none disabled:opacity-50',
				className
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			className={cn('outline-none', className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
