import { describe, expect, it } from 'vitest';
import { BREATH_PATTERNS, breathStateAt, breathTrace } from './breath';
import { CAMERA_VIEWS, DIAL_VIEWS } from './camera';
import { computeOverrides, dialOffset, phaseWindow, zoneFor } from './dials';
import {
	detectStance,
	footfallsCrossed,
	gaitPhaseAt,
	inInterval,
} from './gait';
import { mod } from './math';
import { paceProfile, paceZone, suggestedBreath } from './pace';
import {
	FAULT_PRESETS,
	FIXED_LINE,
	isRunnerFixed,
	presetDials,
} from './presets';
import {
	MIXAMO_BONES,
	normaliseClipName,
	resolveBones,
	sanitiseNodeName,
} from './rig';
import { INITIAL_STATE, reducer } from './state';
import {
	BASE_IDEAL,
	TERRAIN_IDEALS,
	TERRAIN_SLOPE_DEG,
	movedDials,
} from './terrain';
import {
	BREATH_IDS,
	CAMERA_VIEW_IDS,
	DIAL_IDS,
	PRESET_IDS,
	TERRAIN_IDS,
} from './types';

describe('dials', () => {
	it('zones a value against the ideal', () => {
		expect(zoneFor(60, 60, 8)).toBe('ideal');
		expect(zoneFor(51, 60, 8)).toBe('low');
		expect(zoneFor(69, 60, 8)).toBe('high');
	});

	it('normalises each side of the ideal to reach ±1 at the ends', () => {
		expect(dialOffset(0, 60)).toBe(-1);
		expect(dialOffset(100, 60)).toBe(1);
		expect(dialOffset(60, 60)).toBe(0);
		expect(dialOffset(150, 60)).toBe(1);
	});

	it('is all-zero at the flat-ground ideal, at every phase', () => {
		for (const phase of [0, 0.2, 0.5, 0.9]) {
			const o = computeOverrides(BASE_IDEAL, phase);
			const { reach, toeStance, ...rest } = o;
			expect(Object.values(rest).every((v) => v === 0)).toBe(true);
			expect([
				reach.left,
				reach.right,
				toeStance.left,
				toeStance.right,
			]).toEqual([0, 0, 0, 0]);
		}
	});

	it('leans uphill from the ankles rather than folding at the waist', () => {
		const o = computeOverrides(TERRAIN_IDEALS.uphill, 0);
		expect(o.bodyPitch).toBeGreaterThan(0);
		expect(o.spineFold).toBe(0);
	});

	it('folds at the waist only near the far end', () => {
		expect(
			computeOverrides({ ...BASE_IDEAL, lean: 100 }, 0).spineFold
		).toBeGreaterThan(0.5);
	});

	it('reaches out only around contact, per leg', () => {
		const heel = { ...BASE_IDEAL, footstrike: 0 };
		const atLeftContact = computeOverrides(heel, 0);
		const midSwingLeft = computeOverrides(heel, 0.55);
		expect(atLeftContact.reach.left).toBeGreaterThan(0.5);
		expect(atLeftContact.reach.right).toBe(0);
		expect(midSwingLeft.reach.left).toBe(0);
	});

	it('bounces more on the bouncing end and sits lower when shuffling', () => {
		const flight = 0.425;
		expect(
			computeOverrides({ ...BASE_IDEAL, bounce: 0 }, flight).hipsY
		).toBeGreaterThan(0.05);
		expect(
			computeOverrides({ ...BASE_IDEAL, bounce: 100 }, flight).hipsY
		).toBeLessThan(0);
	});

	it('windows a wrapping phase', () => {
		expect(phaseWindow(0.97, 0.97, 0.2)).toBeCloseTo(1);
		expect(phaseWindow(0.05, 0.97, 0.2)).toBeGreaterThan(0);
		expect(phaseWindow(0.5, 0.97, 0.2)).toBe(0);
	});
});

describe('gait', () => {
	// A foot that is down for the first 35% of the cycle.
	const heights = Array.from({ length: 120 }, (_, i) => {
		const p = i / 120;
		return p < 0.35 ? 0 : Math.sin(((p - 0.35) / 0.65) * Math.PI) * 0.3;
	});

	it('finds the stance window', () => {
		const [start, end] = detectStance(heights);
		// The foot is within the threshold just before it lands, so the window
		// may open a sample or two before phase 0: compare circularly.
		expect(Math.min(start, 1 - start)).toBeLessThan(0.05);
		expect(end).toBeGreaterThan(0.35);
		expect(end).toBeLessThan(0.45);
	});

	it('finds a stance that wraps the seam', () => {
		const shifted = [...heights.slice(90), ...heights.slice(0, 90)];
		const [start, end] = detectStance(shifted);
		expect(start).toBeCloseTo(0.25, 1);
		expect(end).toBeLessThan(start + 0.45);
	});

	it('wraps a phase into one stride', () => {
		expect(mod(1.25)).toBeCloseTo(0.25);
		expect(mod(-0.25)).toBeCloseTo(0.75);
	});

	const stances = { left: [0, 0.35], right: [0.5, 0.85] } as const;

	it('labels the phases of a stride', () => {
		expect(gaitPhaseAt(0.02, stances)).toEqual({
			phase: 'contact',
			side: 'left',
		});
		expect(gaitPhaseAt(0.15, stances)).toEqual({
			phase: 'midstance',
			side: 'left',
		});
		expect(gaitPhaseAt(0.3, stances)).toEqual({
			phase: 'toeOff',
			side: 'left',
		});
		expect(gaitPhaseAt(0.42, stances)).toEqual({
			phase: 'flight',
			side: 'left',
		});
		expect(gaitPhaseAt(0.6, stances).side).toBe('right');
		expect(gaitPhaseAt(0.95, stances)).toEqual({
			phase: 'flight',
			side: 'right',
		});
	});

	it('handles wrapping intervals', () => {
		expect(inInterval(0.95, [0.9, 0.1])).toBe(true);
		expect(inInterval(0.05, [0.9, 0.1])).toBe(true);
		expect(inInterval(0.5, [0.9, 0.1])).toBe(false);
	});

	it('counts footfalls crossed, across the wrap', () => {
		expect(footfallsCrossed(0.9, 0.1, [0, 0.5])).toBe(1);
		expect(footfallsCrossed(0.4, 0.6, [0, 0.5])).toBe(1);
		expect(footfallsCrossed(0.1, 0.2, [0, 0.5])).toBe(0);
	});
});

describe('pace', () => {
	it('zones the slider', () => {
		expect([0, 30, 60, 90].map(paceZone)).toEqual([
			'easy',
			'steady',
			'tempo',
			'fast',
		]);
	});

	it('blends clips with weights that sum to 1', () => {
		for (const pace of [0, 20, 50, 70, 100]) {
			const { weights } = paceProfile(pace);
			expect(weights.jog + weights.run + weights.sprint).toBeCloseTo(1);
		}
		expect(paceProfile(0).weights.jog).toBe(1);
		expect(paceProfile(100).weights.sprint).toBe(1);
	});

	it('raises cadence faster than it moves the blend', () => {
		const quarter = paceProfile(25);
		const cadenceProgress = (quarter.cadenceSpm - 162) / 26;
		const blendProgress =
			(quarter.weights.run + 2 * quarter.weights.sprint) / 2;
		expect(cadenceProgress).toBeGreaterThan(blendProgress);
	});

	it('suggests a breath per pace', () => {
		expect(suggestedBreath(10, 'track')).toBe('3-2');
		expect(suggestedBreath(60, 'track')).toBe('2-2');
		expect(suggestedBreath(60, 'uphill')).toBe('2-1');
		expect(suggestedBreath(90, 'track')).toBe('2-1');
	});
});

describe('breath', () => {
	it('inhales then exhales over the pattern', () => {
		expect(breathStateAt(0, 0.5, '3-2').phase).toBe('in');
		expect(breathStateAt(3, 0, '3-2').phase).toBe('out');
		expect(breathStateAt(5, 0, '3-2')).toEqual({ phase: 'in', level: 0 });
		expect(breathStateAt(2, 0.99, '3-2').level).toBeGreaterThan(0.99);
	});

	it('alternates the exhale foot only for odd patterns', () => {
		const exhaleFeet = (id: (typeof BREATH_IDS)[number]) =>
			breathTrace(id)
				.filter((t) => t.exhaleStart)
				.map((t) => t.side);
		expect(exhaleFeet('3-2')).toEqual(['right', 'left']);
		expect(exhaleFeet('2-1')).toEqual(['left', 'right']);
		expect(exhaleFeet('2-2')).toEqual(['left', 'left']);
	});

	it('draws two cycles', () => {
		for (const id of BREATH_IDS) {
			const { inhale, exhale } = BREATH_PATTERNS[id];
			expect(breathTrace(id)).toHaveLength((inhale + exhale) * 2);
		}
	});
});

describe('terrain, presets and camera cover every id', () => {
	it('has an ideal and a slope per terrain', () => {
		for (const t of TERRAIN_IDS) {
			expect(Object.keys(TERRAIN_IDEALS[t]).sort()).toEqual(
				[...DIAL_IDS].sort()
			);
			expect(typeof TERRAIN_SLOPE_DEG[t]).toBe('number');
		}
		expect(movedDials('riverside')).toEqual([]);
		expect(movedDials('trail')).toContain('gaze');
	});

	it('has a view per camera id and per dial', () => {
		for (const v of CAMERA_VIEW_IDS) expect(CAMERA_VIEWS[v]).toBeDefined();
		for (const d of DIAL_IDS) expect(CAMERA_VIEW_IDS).toContain(DIAL_VIEWS[d]);
	});

	it('puts every fault preset outside the ideal, and club inside it', () => {
		for (const id of PRESET_IDS) {
			expect(FAULT_PRESETS[id]).toBeDefined();
			const fixed = isRunnerFixed(presetDials(id, 'riverside'), 'riverside');
			expect(fixed).toBe(id === 'club');
			if (id !== 'club') expect(FIXED_LINE[id]).toBeDefined();
		}
	});

	it('widens the trail arm zone', () => {
		expect(isRunnerFixed({ ...TERRAIN_IDEALS.trail, arms: 82 }, 'trail')).toBe(
			true
		);
		expect(isRunnerFixed({ ...TERRAIN_IDEALS.track, arms: 82 }, 'track')).toBe(
			false
		);
	});
});

describe('state', () => {
	it('starts on club form at the riverside', () => {
		expect(isRunnerFixed(INITIAL_STATE.dials, INITIAL_STATE.terrain)).toBe(
			true
		);
		expect(INITIAL_STATE.preset).toBeNull();
	});

	it('loads a preset, then is fixed dial by dial', () => {
		let s = reducer(INITIAL_STATE, { type: 'loadPreset', id: 'sitter' });
		expect(s.preset).toBe('sitter');
		expect(isRunnerFixed(s.dials, s.terrain)).toBe(false);
		for (const id of DIAL_IDS)
			s = reducer(s, {
				type: 'setDial',
				id,
				value: TERRAIN_IDEALS.riverside[id],
			});
		expect(isRunnerFixed(s.dials, s.terrain)).toBe(true);
		expect(s.preset).toBe('sitter');
	});

	it('club form resets and clears the preset', () => {
		const s = reducer(
			reducer(INITIAL_STATE, { type: 'loadPreset', id: 'heel' }),
			{
				type: 'loadPreset',
				id: 'club',
			}
		);
		expect(s.preset).toBeNull();
		expect(s.dials).toEqual(TERRAIN_IDEALS.riverside);
	});

	it('moves the camera on dial focus only while armed', () => {
		const armed = reducer(INITIAL_STATE, { type: 'focusDial', id: 'arms' });
		expect(armed.cameraView).toBe('front');
		const orbited = reducer(INITIAL_STATE, {
			type: 'setCameraView',
			view: null,
		});
		expect(
			reducer(orbited, { type: 'focusDial', id: 'arms' }).cameraView
		).toBeNull();
	});

	it('clamps and wraps inputs', () => {
		expect(reducer(INITIAL_STATE, { type: 'setPace', value: 140 }).pace).toBe(
			100
		);
		expect(
			reducer(INITIAL_STATE, { type: 'setScrub', phase: 1.25 }).scrub.phase
		).toBeCloseTo(0.25);
	});
});

describe('rig', () => {
	it('mirrors GLTFLoader name sanitisation', () => {
		expect(sanitiseNodeName('mixamorig:Hips')).toBe('mixamorigHips');
		expect(normaliseClipName('Armature|jog')).toBe('jog');
	});

	it('resolves bones by name and reports the missing ones', () => {
		const tree = {
			name: 'root',
			children: [
				{
					name: MIXAMO_BONES.hips,
					children: [{ name: MIXAMO_BONES.spine, children: [] }],
				},
			],
		};
		const { bones, missing } = resolveBones(tree);
		expect(bones.hips?.name).toBe(MIXAMO_BONES.hips);
		expect(bones.spine).toBeDefined();
		expect(missing).toContain('head');
	});
});

describe('playhead', async () => {
	const { createPlayhead } = await import('./playhead');

	it('throttles notifications unless forced', () => {
		const playhead = createPlayhead(100);
		let calls = 0;
		playhead.subscribe(() => calls++);
		playhead.set(0.1, 0, 0);
		playhead.set(0.2, 0, 50);
		expect(calls).toBe(1);
		expect(playhead.get().phase).toBe(0.1);
		playhead.set(0.3, 0, 60, true);
		expect(calls).toBe(2);
		playhead.set(0.4, 1, 200);
		expect(playhead.get()).toEqual({ phase: 0.4, step: 1 });
	});

	it('keeps a stable snapshot between notifications', () => {
		const playhead = createPlayhead();
		const a = playhead.get();
		playhead.set(0, 0, 0);
		expect(playhead.get()).toBe(a);
	});
});

describe('kit', async () => {
	const { isNodeVisible, isKitNode, decalFor, BODY_NODES } =
		await import('./kit');

	it('hides the body a garment covers, and nothing else', () => {
		expect(isNodeVisible('Body_torsoLower', 'coda')).toBe(false);
		expect(isNodeVisible('Body_torsoUpper', 'coda')).toBe(true);
		expect(isNodeVisible('Body_torsoUpper', 'hoole')).toBe(false);
		expect(isNodeVisible('Body_armTop', 'coda')).toBe(true);
		expect(isNodeVisible('Body_armTop', 'component')).toBe(false);
		expect(isNodeVisible('Body_armMid', 'hoole')).toBe(true);
		expect(isNodeVisible('Body_feet', 'coda')).toBe(false);
		expect(isNodeVisible('Body_head', 'hoole')).toBe(true);
		expect(isNodeVisible('Body_arms', 'component')).toBe(true);
		expect(isNodeVisible('Body_hands', 'hoole')).toBe(true);
		expect(isNodeVisible('Body_thighTop', 'coda')).toBe(false);
	});

	it('shows exactly one top, with its own decals', () => {
		expect(isNodeVisible('Top_hoole', 'hoole')).toBe(true);
		expect(isNodeVisible('Top_hoole_decal0', 'hoole')).toBe(true);
		expect(isNodeVisible('Top_coda', 'hoole')).toBe(false);
		expect(isNodeVisible('Top_coda_decal0', 'hoole')).toBe(false);
		expect(isNodeVisible('Bottom_tight', 'coda')).toBe(true);
		expect(isNodeVisible('Shoes_upper', 'coda')).toBe(true);
	});

	it('keeps the hair in its own colour, whatever the top', () => {
		expect(isKitNode('Hair')).toBe(true);
		expect(isNodeVisible('Hair', 'coda')).toBe(true);
	});

	it('tells kit from body, and names decals', () => {
		expect(isKitNode('Shoes_decal0')).toBe(true);
		expect(BODY_NODES.some(isKitNode)).toBe(false);
		expect(decalFor('Decal_blkwtr')).toBe('blkwtr');
		expect(decalFor('Fabric_coda')).toBeNull();
	});
});
