import { cn } from '@/lib/utils';

/**
 * The cart's item count, as a filled circle. Shared by the header trigger and
 * the drawer title so the two can't drift apart.
 *
 * `bg-foreground`/`text-background` inverts against whatever surface it sits
 * on with no per-location override: a light circle on the dark header shell,
 * and a dark one inside the drawer, where `.cart-surface` pins those tokens to
 * their :root values.
 *
 * `h-4 min-w-4 px-0.5` stays a true circle at one and two digits — two 10px
 * tabular digits plus this padding come to 15px, inside the 16px minimum — and
 * only relaxes into a pill past 99 rather than clipping. `px-1` is too much
 * here: it pushes two digits to 19px and the circle renders as an oval.
 *
 * Positioning is the caller's job (`className`): both sites pin it to the
 * top-right of the "cart" label, so it has to overhang a box this component
 * can't see.
 *
 * Always `aria-hidden`: both call sites already carry the count in their own
 * accessible text, so announcing this too would read it twice.
 */
export default function CartCountBadge({
	count,
	className,
}: {
	count: number;
	className?: string;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				't-l-2 bg-foreground text-background inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 tabular-nums',
				className
			)}
		>
			{count}
		</span>
	);
}
