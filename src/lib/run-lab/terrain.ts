import type { DialId, Dials, Terrain } from './types';

/**
 * The ideal on flat ground. Posture maths is ABSOLUTE against this, so
 * `computeOverrides` is all-zero here, and a terrain moves the ideal mark (and
 * the Pacer) rather than the meaning of a dial position.
 */
export const BASE_IDEAL: Dials = {
	lean: 60,
	footstrike: 65,
	arms: 70,
	shoulders: 65,
	gaze: 60,
	bounce: 65,
};

/** Half-width of the ideal zone, in dial points. */
export const IDEAL_TOLERANCE = 8;

// A "notch" is 10 points. Bounce runs bouncing (low) → shuffling (high), so
// "less bounce" is a HIGHER value.
export const TERRAIN_IDEALS: Record<Terrain, Dials> = {
	track: BASE_IDEAL,
	riverside: BASE_IDEAL,
	trail: { ...BASE_IDEAL, footstrike: 75, gaze: 50, bounce: 75 },
	uphill: { ...BASE_IDEAL, lean: 75, footstrike: 75, gaze: 50, bounce: 75 },
	downhill: { ...BASE_IDEAL, footstrike: 75, bounce: 80 },
};

/** Trail widens the arm zone (a touch wider for balance) instead of moving it. */
export const TERRAIN_TOLERANCE: Partial<
	Record<Terrain, Partial<Record<DialId, number>>>
> = {
	trail: { arms: 14 },
};

export function toleranceFor(terrain: Terrain, dial: DialId): number {
	return TERRAIN_TOLERANCE[terrain]?.[dial] ?? IDEAL_TOLERANCE;
}

/** Ground tilt; the runner rides inside the tilted group, perpendicular to it. */
export const TERRAIN_SLOPE_DEG: Record<Terrain, number> = {
	track: 0,
	riverside: 0,
	trail: 0,
	uphill: 8,
	downhill: -6,
};

/** Dials whose ideal this terrain moves away from flat ground. */
export function movedDials(terrain: Terrain): DialId[] {
	const ideal = TERRAIN_IDEALS[terrain];
	return (Object.keys(BASE_IDEAL) as DialId[]).filter(
		(id) => ideal[id] !== BASE_IDEAL[id]
	);
}
