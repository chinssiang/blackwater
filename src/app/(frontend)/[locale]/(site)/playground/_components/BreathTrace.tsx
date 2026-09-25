'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { breathTrace } from '@/lib/run-lab/breath';
import { mod } from '@/lib/run-lab/math';
import type { Playhead } from '@/lib/run-lab/playhead';
import type { BreathId } from '@/lib/run-lab/types';
import { cn } from '@/lib/utils';
import type { PlaygroundCopy } from './playground-shared';

/**
 * Two breath cycles laid out as footfalls: IN/OUT brackets over the ticks,
 * the foot under each. The first exhale footfall of each cycle is drawn
 * heavier -- for an odd pattern its foot flips between the two cycles, which
 * is the whole point of 3:2 and 2:1, drawn rather than explained. The tick for
 * the current step is lit; held (scrubbing or reduced motion), it follows the
 * scrub position instead of sweeping.
 */
export function BreathTrace({
	t,
	breath,
	playhead,
	hold,
	heldPhase,
}: {
	t: PlaygroundCopy;
	breath: BreathId;
	playhead: Playhead;
	hold: boolean;
	heldPhase: number;
}) {
	// Subscribe to the step count alone: a number, so React skips the
	// re-render on every playhead notify that did not cross a footfall.
	const getStep = () => playhead.get().step;
	const liveStep = useSyncExternalStore(playhead.subscribe, getStep, getStep);
	const { ticks, groups } = useMemo(() => {
		const ticks = breathTrace(breath);
		const groups: { phase: 'in' | 'out'; span: number }[] = [];
		for (const tick of ticks) {
			const last = groups[groups.length - 1];
			if (last?.phase === tick.phase) last.span++;
			else groups.push({ phase: tick.phase, span: 1 });
		}
		return { ticks, groups };
	}, [breath]);
	const step = hold ? (heldPhase < 0.5 ? 0 : 1) : liveStep;
	const active = mod(step, ticks.length);
	const columns = {
		gridTemplateColumns: `repeat(${ticks.length}, minmax(0, 1fr))`,
	};

	return (
		<figure aria-label={t.breath.trace.label} className="mt-4">
			<div aria-hidden className="grid gap-x-1" style={columns}>
				{groups.map((g, i) => (
					<span
						key={i}
						className="border-foreground/40 t-spec text-foreground/60 border-t pt-1 uppercase"
						style={{ gridColumn: `span ${g.span}` }}
					>
						{g.phase === 'in' ? t.breath.trace.in : t.breath.trace.out}
					</span>
				))}
				{ticks.map((tick, i) => (
					<span key={`tick-${i}`} className="flex h-6 items-end justify-center">
						<span
							className={cn(
								'block',
								tick.exhaleStart
									? 'bg-foreground h-4 w-0.5'
									: 'bg-foreground/40 h-3 w-px',
								i === active && 'bg-foreground h-5'
							)}
						/>
					</span>
				))}
				{ticks.map((tick, i) => (
					<span
						key={`foot-${i}`}
						className={cn(
							't-spec text-center uppercase',
							tick.exhaleStart || i === active
								? 'text-foreground'
								: 'text-foreground/50'
						)}
					>
						{tick.side === 'left' ? t.breath.trace.left : t.breath.trace.right}
					</span>
				))}
			</div>
		</figure>
	);
}
