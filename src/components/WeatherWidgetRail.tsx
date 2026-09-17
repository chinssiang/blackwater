import { cn } from '@/lib/utils';
import { WeatherWidget } from '@/components/WeatherWidgetLazy';

/**
 * The weather widget's mount for a page that owns its own content region --
 * today the two events pages, which want it to ride the bottom of their section
 * and leave with it rather than float over the newsletter and footer.
 *
 * This exists because the widget CANNOT simply be made `sticky` itself. Its
 * detail panel is in flow below its trigger, so the box grows upward off a
 * bottom anchor -- and a bottom-anchored box that is itself in flow turns that
 * growth into real layout. Measured before this wrapper existed: opening the
 * panel added 198px of document height, shoved the newsletter and footer down
 * by the same, and once the widget had settled at its section's end dragged its
 * own bottom edge down 53px.
 *
 * So the RAIL is the sticky element and the widget is a normal in-flow child of
 * it, and the rail's height is FIXED. An over-tall flex item overflows its
 * container's start edge rather than stretching it, so `items-end` pins the
 * widget's bottom to the rail while the panel grows past the top and the rail's
 * own height -- the only part that is layout -- never changes.
 *
 * `justify-end` rather than the widget's `right-contain` default, which is inert
 * on an in-flow box: the gutter is then whatever the rail's own box gives it, so
 * a caller inside a `p-x-max` root passes nothing and one without it passes
 * `m-x-max`. That is also why there is no negative margin here cancelling a
 * parent's padding -- the same call `products/layout.tsx` makes, and for the
 * reason its comment gives.
 *
 * `pointer-events-none` on the rail, `pointer-events-auto` back on the widget:
 * the rail is as wide as its container but the pill is at most 256px, so the
 * rest of that 44px band is an invisible bar pinned across the bottom of the
 * viewport. Without the pair it is the topmost hit target over the events
 * list -- measured at 1024px, 707px of dead width sitting on two rows'
 * stretched `a.p-fill` links -- and it absorbs those clicks even before the
 * first fetch resolves, when the widget renders nothing at all. Same pair, for
 * the same reason, as `products/layout.tsx` and `ProductSubmission.tsx`.
 *
 * `z-g-toolbar` belongs on the rail, not the widget: `position: sticky` always
 * creates a stacking context, so the widget's own z-index would be trapped
 * inside it and could not clear the events month bar's `sticky top-header z-10`.
 *
 * `h-11` is the flow reserve and must stay >= the collapsed pill, which is
 * `2px border + 20px padding + one line of t-b-2`. That rung clamps
 * `0.75rem -> 0.8125rem` at line-height 1.5, so the pill is 40px at the low end
 * and 41.5px at the high end and never more; 44px clears it at every width.
 * `weather-widget-mounts.test.ts` fails if that stops being true.
 */
export function WeatherWidgetRail({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				'z-g-toolbar pointer-events-none sticky bottom-[calc(var(--height-g-toolbar)+1rem)] flex h-11 items-end justify-end lg:bottom-6',
				className
			)}
		>
			<WeatherWidget className="pointer-events-auto static" />
		</div>
	);
}
