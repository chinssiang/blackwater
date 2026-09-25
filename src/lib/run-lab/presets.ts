import { TERRAIN_IDEALS, toleranceFor } from './terrain';
import type { DialId, Dials, PresetId, Terrain } from './types';

/** Dials each archetype pushes toward its fault; the rest stay at the ideal. */
export const FAULT_PRESETS: Record<PresetId, Partial<Dials>> = {
	club: {},
	heel: { footstrike: 15, bounce: 40, lean: 45 },
	bouncer: { bounce: 15, footstrike: 40 },
	shoulders: { shoulders: 15, arms: 45 },
	arms: { arms: 10, shoulders: 45 },
	sitter: { lean: 15, footstrike: 30, bounce: 45 },
	gazer: { gaze: 10, lean: 80, shoulders: 45 },
};

export function presetDials(id: PresetId, terrain: Terrain): Dials {
	return { ...TERRAIN_IDEALS[terrain], ...FAULT_PRESETS[id] };
}

export function isRunnerFixed(dials: Dials, terrain: Terrain): boolean {
	const ideal = TERRAIN_IDEALS[terrain];
	return (Object.keys(ideal) as DialId[]).every(
		(id) => Math.abs(dials[id] - ideal[id]) <= toleranceFor(terrain, id)
	);
}

/** Which payoff line a fixed preset earns (index into `presets.fixed.lines`). */
export const FIXED_LINE: Record<Exclude<PresetId, 'club'>, 0 | 1 | 2> = {
	sitter: 0,
	heel: 0,
	shoulders: 1,
	arms: 1,
	bouncer: 2,
	gazer: 2,
};
