import type { BreathId, Side } from './types';

export const BREATH_PATTERNS: Record<
	BreathId,
	{ inhale: number; exhale: number }
> = {
	'3-2': { inhale: 3, exhale: 2 },
	'2-2': { inhale: 2, exhale: 2 },
	'2-1': { inhale: 2, exhale: 1 },
};

export type BreathState = {
	phase: 'in' | 'out';
	/** Lung fill 0..1: rises over the inhale steps, falls over the exhale ones. */
	level: number;
};

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * Breath at a point in the stride. `step` counts footfalls since the start
 * (left foot on even steps), `intra` is how far into the current step, 0..1.
 */
export function breathStateAt(
	step: number,
	intra: number,
	id: BreathId
): BreathState {
	const { inhale, exhale } = BREATH_PATTERNS[id];
	const cycle = inhale + exhale;
	const pos = (((step % cycle) + cycle) % cycle) + intra;
	if (pos < inhale) return { phase: 'in', level: smooth(pos / inhale) };
	return { phase: 'out', level: smooth(1 - (pos - inhale) / exhale) };
}

export type TraceTick = {
	side: Side;
	phase: 'in' | 'out';
	/** The first exhale footfall of a breath cycle: the step the trace marks. */
	exhaleStart: boolean;
};

/** Two full breath cycles of footfalls, starting on the left foot. */
export function breathTrace(id: BreathId): TraceTick[] {
	const { inhale, exhale } = BREATH_PATTERNS[id];
	const cycle = inhale + exhale;
	return Array.from({ length: cycle * 2 }, (_, i) => {
		const pos = i % cycle;
		return {
			side: i % 2 === 0 ? 'left' : 'right',
			phase: pos < inhale ? 'in' : 'out',
			exhaleStart: pos === inhale,
		};
	});
}

/** Chest expansion for the rig: forward and sideways more than upward. */
export function chestScaleFor(
	level: number
): [x: number, y: number, z: number] {
	return [1 + 0.05 * level, 1 + 0.02 * level, 1 + 0.08 * level];
}
