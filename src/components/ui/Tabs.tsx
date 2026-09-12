'use client';

import { type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

// A leaf module, deliberately: importing the variant from THIS file drags
// `@base-ui/react/tabs` into the caller's bundle, which is dead weight for a
// caller that renders no tabs. See the note in that file before moving it back.
import { tabsTriggerVariants } from '@/components/ui/tabsTriggerVariants';
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

function TabsTrigger({
	className,
	variant,
	size,
	...props
}: TabsPrimitive.Tab.Props & VariantProps<typeof tabsTriggerVariants>) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(tabsTriggerVariants({ variant, size }), className)}
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
