'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useProgressActive } from '@/components/progress/ProgressProvider';

/**
 * The site-wide loading hairline, pinned to the top of the viewport.
 *
 * Lifted out of the product filter toolbar, where it was `absolute` inside a
 * `sticky` bar and so could only ever report that one control's work. Anything
 * that calls `startProgress` now drives it.
 *
 * It fills left-to-right rather than looping: an indeterminate shuttle says
 * "busy" but never "how far", which is the whole point of a progress bar.
 *
 * `z-overlay` (100) rather than the header's 90: the header is `fixed top-0`
 * with a `backdrop-filter`, which paints over anything at or below its rung, so
 * a lower bar would be invisible at exactly the position it sits. No
 * announcement-bar offset is needed at `top-0` -- it is above that too.
 *
 * `aria-hidden`, because a decorative bar cannot say WHICH region is busy; the
 * accessible signal stays as `aria-busy` on the region doing the work.
 *
 * A client navigation reports no completion percentage -- `router.push` returns
 * nothing to measure and React's transition exposes only "still working". So
 * the fill is MODELLED, not observed: it eases toward a ceiling it never
 * reaches while the work is in flight, then completes when the work lands.
 * That is the honest shape for unmeasurable work. It always moves forward, it
 * never reaches 100% before the action does, and it cannot claim a finish that
 * has not happened.
 *
 * The fill lives HERE rather than in `ProgressProvider` for the reason that
 * file gives: the provider wraps the whole client tree, and this is the only
 * reader. A tick now re-renders one childless leaf.
 */
const START = 0.08; // a head start, so the bar is visible the instant it opens
const CEILING = 0.9; // never reached while pending -- only completion gets there
const EASE = 0.12; // fraction of the remaining gap closed per tick
const TICK_MS = 240;
// The gap at which the trickle has converged: a step this small is sub-pixel on
// a 2px bar, so the interval clears itself rather than ticking on unseen.
const SETTLED = 0.005;
// How long the finished value is held before it resets to 0. It is NOT a hold at
// full opacity -- the bar fades out as it fills, so this only has to outlast the
// 300ms fade below, or the reset would cut it short.
const COMPLETE_MS = 400;

export default function GlobalProgressBar() {
	const isPending = useProgressActive();
	// 0 means "nothing to show", 1 means "just finished".
	const [value, setValue] = useState(0);
	const [prevPending, setPrevPending] = useState(false);

	// Both edges of a navigation are derived DURING RENDER, the pattern React
	// documents for adjusting state when an input changes. Doing it in an effect
	// instead means an extra render pass before the bar appears -- and the
	// compiler lint rejects the synchronous setState outright.
	if (prevPending !== isPending) {
		setPrevPending(isPending);
		setValue(isPending ? START : 1);
	}

	// Decelerating trickle: each tick closes the same FRACTION of what is left,
	// so the steps shrink as the bar fills and it approaches CEILING without ever
	// arriving. A linear ramp would either reach the end while still loading, or
	// need a guess at how long the work takes.
	//
	// `settled` is a DEP, not a test inside the updater: a guard in the updater
	// only makes React bail on the re-render, leaving the timer firing every
	// TICK_MS for as long as the navigation hangs. As a dep it is stable across
	// ticks until it flips, so the interval is created once and then genuinely
	// cleared.
	const settled = CEILING - value < SETTLED;
	useEffect(() => {
		if (!isPending || settled) return;
		const id = setInterval(
			() => setValue((v) => v + (CEILING - v) * EASE),
			TICK_MS
		);
		return () => clearInterval(id);
	}, [isPending, settled]);

	// Let the finish render, then clear. Keyed on the completion edge, not on
	// `value`: on `[value]` this effect tore down and re-armed on every tick to
	// immediately bail.
	const finished = value >= 1;
	useEffect(() => {
		if (!finished) return;
		const id = setTimeout(() => setValue(0), COMPLETE_MS);
		return () => clearTimeout(id);
	}, [finished]);

	// Always mounted. Returning null while idle gave the entry no previous value
	// to transition FROM (the bar popped in) and removed the node before the exit
	// fade finished. One element, not a wrapper plus a fill: `scaleX` with
	// `value <= 1` and `origin-left` can never overflow the box, so there is
	// nothing to clip.
	//
	// `scaleX` rather than an animated `width`: transform is compositor-driven,
	// so a tick never lays out the page. Reduced motion drops the easing rather
	// than the bar -- the movement here is information, not decoration, so it
	// still updates; it just steps to each value instead of gliding.
	return (
		<div
			aria-hidden
			className={cn(
				'bg-primary z-overlay pointer-events-none fixed inset-x-0 top-0 h-0.5 origin-left duration-300 ease-out motion-reduce:transition-none',
				// At rest the transform has to SNAP back to 0, because the element is
				// always mounted and the reset (1 -> 0) would otherwise still be easing
				// when the next navigation begins -- the bar then faded in while running
				// backward from wherever that ramp had got to. Only `opacity` is
				// transitioned at 0; `transform` rejoins as soon as there is something
				// to show. Switched by a ternary rather than an inline
				// `transitionProperty`, which would beat `motion-reduce:transition-none`
				// and hand reduced-motion visitors the animation back.
				value === 0 ? 'transition-opacity' : 'transition-[transform,opacity]'
			)}
			style={{
				transform: `scaleX(${value})`,
				opacity: value > 0 && value < 1 ? 1 : 0,
			}}
		/>
	);
}
