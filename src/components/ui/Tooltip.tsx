'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

import { cn } from '@/lib/utils';

function TooltipProvider({
	delay = 0,
	...props
}: TooltipPrimitive.Provider.Props) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delay={delay}
			{...props}
		/>
	);
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
	return (
		<TooltipProvider>
			<TooltipPrimitive.Root data-slot="tooltip" {...props} />
		</TooltipProvider>
	);
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

// Placement props go to the Positioner, and so does the z-index: it is the
// positioned element, so a `z-*` on the Popup would not take part in stacking.
// `z-tooltip` is the top rung of the ladder in globals.css: a tooltip is
// transient and has to clear the dialog it was opened from (FieldStatus renders
// inside the ProductSubmission dialog and popover). On the ladder rather than a
// local calc(), so every stacking level reads from one list.
function TooltipContent({
	className,
	side = 'top',
	sideOffset = 0,
	align = 'center',
	alignOffset = 0,
	children,
	...props
}: TooltipPrimitive.Popup.Props &
	Pick<
		TooltipPrimitive.Positioner.Props,
		'align' | 'alignOffset' | 'side' | 'sideOffset'
	>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Positioner
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				className="isolate z-tooltip"
			>
				<TooltipPrimitive.Popup
					data-slot="tooltip-content"
					className={cn(
						'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 rounded-md px-3 py-1.5 text-xs bg-foreground text-background w-fit max-w-xs origin-(--transform-origin) motion-reduce:animate-none',
						className
					)}
					{...props}
				>
					{children}
					{/* Base UI places the arrow along the popup's edge (inline left/top);
					    the offset across that edge is ours, per side, so the rotated
					    square's tip clears the popup by ~5px like the old arrow did. */}
					<TooltipPrimitive.Arrow className="size-2.5 rotate-45 rounded-[2px] bg-foreground data-[side=top]:-bottom-[3px] data-[side=bottom]:-top-[3px] data-[side=left]:-right-[3px] data-[side=right]:-left-[3px]" />
				</TooltipPrimitive.Popup>
			</TooltipPrimitive.Positioner>
		</TooltipPrimitive.Portal>
	);
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
