import { DEG, clamp, mod } from './math';
import { BASE_IDEAL, TERRAIN_IDEALS, toleranceFor } from './terrain';
import type { DialId, Dials, Terrain, Zone } from './types';

export function zoneFor(value: number, ideal: number, tolerance: number): Zone {
	if (value < ideal - tolerance) return 'low';
	if (value > ideal + tolerance) return 'high';
	return 'ideal';
}

/** Which zone a dial sits in against this terrain's ideal. */
export function dialZone(dials: Dials, terrain: Terrain, id: DialId): Zone {
	return zoneFor(
		dials[id],
		TERRAIN_IDEALS[terrain][id],
		toleranceFor(terrain, id)
	);
}

/**
 * Signed distance from the ideal, normalised per side so each end of the
 * slider reaches exactly -1 / +1 however far off-centre the ideal sits.
 */
export function dialOffset(value: number, ideal: number): number {
	const v = clamp(value, 0, 100);
	if (v < ideal) return ideal === 0 ? 0 : -(ideal - v) / ideal;
	return ideal === 100 ? 0 : (v - ideal) / (100 - ideal);
}

/** Bone offsets in radians/metres, applied ON TOP of the clip's pose. */
export type Overrides = {
	/** Whole-body pitch about the feet: the lean from the ankles. */
	bodyPitch: number;
	/** Fold at the waist, split over Spine and Spine1. */
	spineFold: number;
	/** Upper-back rounding (Spine2), from slumped shoulders. */
	upperBackRound: number;
	neckPitch: number;
	headPitch: number;
	/** Clavicle lift (shrug), positive = up. */
	shoulderLift: number;
	/** Clavicle roll forward (slump). */
	shoulderForward: number;
	/** Humerus internal rotation: swings the bent forearm across the midline. */
	armCross: number;
	/** Elbow straightening, positive = less bend. */
	elbowUnbend: number;
	/** Per leg: extra thigh flexion / knee extension / toes-up at contact. */
	reach: { left: number; right: number };
	/** Per leg: toes pointed through stance ("on the toes"). */
	toeStance: { left: number; right: number };
	/** Extra hips height, metres. */
	hipsY: number;
};

/** Raised-cosine window on a wrapping phase: 1 at `centre`, 0 beyond `half`. */
export function phaseWindow(phase: number, centre: number, half: number) {
	let d = Math.abs(mod(phase - centre + 0.5) - 0.5);
	if (d >= half) return 0;
	d /= half;
	return 0.5 + 0.5 * Math.cos(Math.PI * d);
}

// Contact sits at leg phase 0. The reach grows through late swing and fades
// early in stance; toes-up covers the stance itself.
const REACH_WINDOW = { centre: 0.97, half: 0.2 } as const;
const STANCE_WINDOW = { centre: 0.17, half: 0.2 } as const;
const low = (x: number) => Math.max(0, -x);
const high = (x: number) => Math.max(0, x);

// Vertical peaks land mid-flight, twice a cycle (see gait timing in the rig).
const FLIGHT_CENTRE = 0.425;

/**
 * Pure mapping from dial positions to bone offsets. Absolute against
 * BASE_IDEAL: the same dial position is the same pose on every terrain, so it
 * is all-zero at BASE_IDEAL and the terrain's ideal shows up as a posture on
 * the Pacer.
 *
 * `phase` is the master stride phase, left contact at 0.
 */
export function computeOverrides(dials: Dials, phase: number): Overrides {
	const lean = dialOffset(dials.lean, BASE_IDEAL.lean);
	const foot = dialOffset(dials.footstrike, BASE_IDEAL.footstrike);
	const arms = dialOffset(dials.arms, BASE_IDEAL.arms);
	const shoulders = dialOffset(dials.shoulders, BASE_IDEAL.shoulders);
	const gaze = dialOffset(dials.gaze, BASE_IDEAL.gaze);
	const bounce = dialOffset(dials.bounce, BASE_IDEAL.bounce);

	// Leaning further than flat-ground ideal starts at the ankles and only
	// folds at the waist over the last stretch, so uphill's ideal leans
	// rather than bends.
	const bodyPitch =
		-12 * DEG * low(lean) + 10 * DEG * Math.min(1, high(lean) * 1.6);
	const spineFold =
		(38 * DEG * Math.max(0, high(lean) - 0.4)) / 0.6 - 5 * DEG * low(lean);

	// Each leg's window runs on its own phase: the right is half a stride on.
	const perLeg = (amount: number, w: { centre: number; half: number }) => ({
		left: amount * phaseWindow(phase, w.centre, w.half),
		right: amount * phaseWindow(mod(phase + 0.5), w.centre, w.half),
	});
	const reach = perLeg(low(foot), REACH_WINDOW);
	const toeStance = perLeg(high(foot), STANCE_WINDOW);

	const wave = Math.cos(4 * Math.PI * (phase - FLIGHT_CENTRE));
	const hipsY =
		0.07 * low(bounce) * wave - high(bounce) * (0.035 + 0.012 * wave);

	return {
		bodyPitch,
		spineFold,
		upperBackRound: 16 * DEG * high(shoulders),
		neckPitch: 20 * DEG * low(gaze) - 14 * DEG * high(gaze),
		headPitch: 22 * DEG * low(gaze) - 16 * DEG * high(gaze),
		shoulderLift: 22 * DEG * low(shoulders),
		shoulderForward: 20 * DEG * high(shoulders),
		armCross: 55 * DEG * low(arms),
		elbowUnbend: 65 * DEG * high(arms),
		reach,
		toeStance,
		hipsY,
	};
}
