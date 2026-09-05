'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';

import { cn } from '@/lib/utils';

// The site's pill tab, as a variant rather than a class string copied per
// route. It was spelled out verbatim in /size-guide and again in /events, and
// the two had already drifted on padding and type scale with nothing recording
// whether that was deliberate — so a restyle of the active fill or the focus
// ring would have landed on one page and not the other. `cva` here mirrors
// `buttonVariants`, which already establishes the pattern for exactly this.
//
// The state selectors are Base UI's `data-active` / `not-data-active`, NOT
// Radix's `data-[state=active]`. Nothing fails loudly if you use the Radix
// spelling against this primitive: the pill simply never fills in, on every
// route at once.
const tabsTriggerVariants = cva(
	'cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				// Unstyled, as this primitive shipped: the default stays a bare
				// passthrough so existing call sites are unaffected.
				default: '',
				pill: 'border-foreground data-active:bg-foreground data-active:text-background not-data-active:hover:bg-foreground/5 rounded-full border uppercase whitespace-nowrap not-data-active:bg-transparent',
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

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsTriggerVariants };
