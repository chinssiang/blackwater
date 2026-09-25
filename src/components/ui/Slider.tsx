'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { cn } from '@/lib/utils';

type SliderProps = Omit<SliderPrimitive.Root.Props<number>, 'children'> & {
	/** Hairline ticks along the track, in value units. */
	marks?: readonly number[];
	/**
	 * An ideal ZONE rather than a target point: drawn as a heavier segment with
	 * a hollow mark at its centre that fills while the value sits inside it.
	 */
	ideal?: { value: number; tolerance: number };
	/** Fill from the minimum to the thumb -- for a progress-like slider only. */
	indicator?: boolean;
	thumbProps?: SliderPrimitive.Thumb.Props;
};

// Base UI renders the thumb as a <div> wrapping a visually hidden
// <input type="range">, and focus lands on that input -- hence
// `has-focus-visible:` on the thumb rather than `focus-visible:`.
//
// The root deliberately carries no `touch-none`: sliders on this site sit
// inside scrolling pages, and Base UI handles a horizontal drag without it.
//
// Positions along the track are inline styles, not interpolated class names
// (which Tailwind cannot see), and they transition so that a moving ideal
// slides rather than jumps.
function Slider({
	className,
	marks,
	ideal,
	indicator = false,
	thumbProps,
	min = 0,
	max = 100,
	value,
	...props
}: SliderProps) {
	const pct = (v: number) => `${((v - min) / (max - min)) * 100}%`;
	const span = (a: number, b: number) => `${((b - a) / (max - min)) * 100}%`;
	const zone = ideal && {
		lo: Math.max(min, ideal.value - ideal.tolerance),
		hi: Math.min(max, ideal.value + ideal.tolerance),
	};
	const inZone =
		ideal !== undefined &&
		typeof value === 'number' &&
		Math.abs(value - ideal.value) <= ideal.tolerance;
	const position =
		'transition-[left,width] duration-300 ease-out motion-reduce:transition-none';

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			data-in-zone={inZone || undefined}
			min={min}
			max={max}
			value={value}
			className={cn(
				'group/slider relative w-full select-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
				className
			)}
			{...props}
		>
			<SliderPrimitive.Control
				data-slot="slider-control"
				className="flex h-8 w-full items-center"
			>
				<SliderPrimitive.Track
					data-slot="slider-track"
					className="bg-foreground/15 relative h-px w-full"
				>
					{indicator && (
						<SliderPrimitive.Indicator
							data-slot="slider-indicator"
							className="bg-foreground/60 absolute h-full"
						/>
					)}
					{marks?.map((m) => (
						<span
							key={m}
							aria-hidden
							data-slot="slider-mark"
							className="bg-foreground/40 absolute top-1/2 h-2 w-px -translate-y-1/2"
							style={{ left: pct(m) }}
						/>
					))}
					{ideal && zone && (
						<>
							<span
								aria-hidden
								data-slot="slider-ideal-zone"
								className={cn(
									'bg-foreground/35 absolute top-1/2 h-0.5 -translate-y-1/2',
									position
								)}
								style={{ left: pct(zone.lo), width: span(zone.lo, zone.hi) }}
							/>
							<span
								aria-hidden
								data-slot="slider-ideal-mark"
								className={cn(
									'border-foreground bg-background group-data-in-zone/slider:bg-foreground absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border',
									'transition-[left,background-color] duration-300 ease-out motion-reduce:transition-none'
								)}
								style={{ left: pct(ideal.value) }}
							/>
						</>
					)}
					<SliderPrimitive.Thumb
						data-slot="slider-thumb"
						{...thumbProps}
						className={cn(
							'bg-foreground has-focus-visible:ring-ring/50 increase-target-size data-dragging:ring-ring/50 relative block size-3 rounded-full transition-[box-shadow] outline-none has-focus-visible:ring-[3px] data-dragging:ring-[3px]',
							thumbProps?.className as string | undefined
						)}
					/>
				</SliderPrimitive.Track>
			</SliderPrimitive.Control>
		</SliderPrimitive.Root>
	);
}

export { Slider };
