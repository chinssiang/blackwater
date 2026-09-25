'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { PauseIcon, PlayIcon } from 'lucide-react';
import { interpolate } from '@/lib/dictionary';
import { type Stances, gaitPhaseAt, phaseBoundaries } from '@/lib/run-lab/gait';
import type { Playhead } from '@/lib/run-lab/playhead';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import type { PlaygroundCopy } from './playground-shared';

const RESOLUTION = 1000;

/**
 * One stride, left contact to left contact. While the runner plays, the thumb
 * follows the playhead; grabbing it holds the stride there. Under reduced
 * motion this is the whole time axis, and the play button is not offered.
 */
export function ScrubBar({
	t,
	hold,
	reduce,
	heldPhase,
	stances,
	playhead,
	onScrub,
	onPlay,
	onPause,
}: {
	t: PlaygroundCopy;
	hold: boolean;
	reduce: boolean;
	heldPhase: number;
	stances: Stances;
	playhead: Playhead;
	onScrub: (phase: number) => void;
	onPlay: () => void;
	onPause: () => void;
}) {
	const live = useSyncExternalStore(
		playhead.subscribe,
		playhead.get,
		playhead.get
	);
	const phase = hold ? heldPhase : live.phase;
	const gait = gaitPhaseAt(phase, stances);
	const marks = useMemo(
		() => phaseBoundaries(stances).map((b) => Math.round(b * RESOLUTION)),
		[stances]
	);
	const phaseText = interpolate(t.scrub.phaseValue, {
		phase: t.scrub.phases[gait.phase].label,
		side: t.scrub.side[gait.side],
	});

	return (
		<div className="bg-background border-foreground/15 px-contain lg:left-contain relative z-10 flex h-11 shrink-0 items-center gap-3 border-t lg:absolute lg:bottom-6 lg:h-12 lg:w-md lg:rounded-lg lg:border lg:px-4">
			{!reduce && (
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={hold ? t.scrub.play : t.scrub.pause}
					onClick={hold ? onPlay : onPause}
				>
					{hold ? <PlayIcon /> : <PauseIcon />}
				</Button>
			)}
			<Slider
				className="min-w-0 flex-1"
				min={0}
				max={RESOLUTION}
				step={5}
				largeStep={125}
				indicator
				value={Math.round(phase * RESOLUTION)}
				marks={marks}
				onValueChange={(v) => onScrub(v / RESOLUTION)}
				thumbProps={{
					getAriaLabel: () => t.scrub.label,
					getAriaValueText: () => phaseText,
				}}
			/>
			<span className="t-spec text-foreground/80 w-28 shrink-0 text-right uppercase">
				{phaseText}
			</span>
		</div>
	);
}
