import { mod as wrap } from './math';
import type { GaitPhase, Interval, Side } from './types';

export function inInterval(p: number, [start, end]: Interval): boolean {
	const x = wrap(p);
	return start <= end ? x >= start && x < end : x >= start || x < end;
}

export function intervalLength([start, end]: Interval): number {
	return start <= end ? end - start : 1 - start + end;
}

/**
 * The stance window of one foot, from its height sampled evenly over one
 * cycle: the longest (wrapping) run of samples within `threshold` of the
 * lowest point. Its start is the footfall.
 */
export function detectStance(
	heights: ArrayLike<number>,
	threshold = 0.2
): Interval {
	const n = heights.length;
	if (n === 0) throw new Error('[run-lab] detectStance needs samples');
	let min = Infinity;
	let max = -Infinity;
	for (let i = 0; i < n; i++) {
		min = Math.min(min, heights[i]);
		max = Math.max(max, heights[i]);
	}
	const cut = min + (max - min) * threshold;
	const down = (i: number) => heights[((i % n) + n) % n] <= cut;
	if (max - min < 1e-9) return [0, 0.9999];

	// Start the scan at a sample that is up, so no run is split by the seam.
	let origin = 0;
	while (down(origin) && origin < n) origin++;

	let best: Interval = [0, 0];
	let bestLen = -1;
	let runStart = -1;
	for (let k = 1; k <= n; k++) {
		const i = origin + k;
		if (down(i) && runStart < 0) runStart = i;
		if ((!down(i) || k === n) && runStart >= 0) {
			const len = i - runStart;
			if (len > bestLen) {
				bestLen = len;
				best = [wrap(runStart / n), wrap(i / n)];
			}
			runStart = -1;
		}
	}
	return best;
}

export type Stances = { left: Interval; right: Interval };

// Within a stance: the first 20% is contact, up to 65% midstance, the rest
// toe-off. Neither foot down is flight.
const CONTACT_END = 0.2;
const MIDSTANCE_END = 0.65;

export function gaitPhaseAt(
	phase: number,
	stances: Stances
): { phase: GaitPhase; side: Side } {
	for (const side of ['left', 'right'] as const) {
		const stance = stances[side];
		if (!inInterval(phase, stance)) continue;
		const t = wrap(phase - stance[0]) / intervalLength(stance);
		return {
			phase:
				t < CONTACT_END
					? 'contact'
					: t < MIDSTANCE_END
						? 'midstance'
						: 'toeOff',
			side,
		};
	}
	// In flight: name the foot that just left the ground.
	const sinceLeft = wrap(phase - stances.left[1]);
	const sinceRight = wrap(phase - stances.right[1]);
	return { phase: 'flight', side: sinceLeft < sinceRight ? 'left' : 'right' };
}

/** How many footfall phases a playhead moving forward from `prev` to `next` crossed. */
export function footfallsCrossed(
	prev: number,
	next: number,
	footfalls: readonly number[]
): number {
	const a = wrap(prev);
	const b = wrap(next);
	let count = 0;
	for (const f of footfalls) {
		const x = wrap(f);
		if (a <= b ? x > a && x <= b : x > a || x <= b) count++;
	}
	return count;
}

/** The phase boundaries of one stride, for the scrub slider's ticks. */
export function phaseBoundaries(stances: Stances): number[] {
	const out: number[] = [];
	for (const side of ['left', 'right'] as const) {
		const [s, e] = stances[side];
		const len = intervalLength(stances[side]);
		out.push(s, wrap(s + len * CONTACT_END), wrap(s + len * MIDSTANCE_END), e);
	}
	return out.sort((x, y) => x - y);
}
