import { clamp } from './math';
import type { BreathId, PaceZone, Terrain } from './types';

export function paceZone(pace: number): PaceZone {
	if (pace <= 25) return 'easy';
	if (pace <= 50) return 'steady';
	if (pace <= 75) return 'tempo';
	return 'fast';
}

/** The one number the page shows: an approximate cadence per zone. */
export const ZONE_CADENCE: Record<PaceZone, number> = {
	easy: 165,
	steady: 172,
	tempo: 178,
	fast: 185,
};

export type ClipWeights = { jog: number; run: number; sprint: number };

export type PaceProfile = { cadenceSpm: number; weights: ClipWeights };

/**
 * Cadence (steps a minute) rises early and eases off; the clip blend, which
 * is where stride length lives, lags behind it. That ordering is the lesson:
 * speed comes from quicker steps before longer ones.
 */
export function paceProfile(pace: number): PaceProfile {
	const t = clamp(pace / 100, 0, 1);
	const cadenceSpm = 162 + 26 * Math.pow(t, 0.7);
	const s = Math.pow(t, 1.4) * 2; // 0..2 across jog → run → sprint
	const weights =
		s <= 1
			? { jog: 1 - s, run: s, sprint: 0 }
			: { jog: 0, run: 2 - s, sprint: s - 1 };
	return { cadenceSpm, weights };
}

export function suggestedBreath(pace: number, terrain: Terrain): BreathId {
	const zone = paceZone(pace);
	if (zone === 'easy' || zone === 'steady') return '3-2';
	if (zone === 'tempo') return terrain === 'uphill' ? '2-1' : '2-2';
	return '2-1';
}
