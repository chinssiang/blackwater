import { DIAL_VIEWS } from './camera';
import { clamp, mod } from './math';
import { presetDials } from './presets';
import { TERRAIN_IDEALS } from './terrain';
import type {
	BreathId,
	CameraView,
	DialId,
	Dials,
	PresetId,
	Terrain,
	TopId,
} from './types';

export type RunLabState = {
	pace: number;
	dials: Dials;
	terrain: Terrain;
	breath: BreathId;
	/** Which club top the runner wears; bottoms and shoes are fixed. */
	top: TopId;
	ghost: boolean;
	/** `on` holds the runner at `phase` (0..1 of one stride, left contact at 0). */
	scrub: { on: boolean; phase: number };
	/** `null` once the visitor orbits by hand: focus stops moving the camera. */
	cameraView: CameraView | null;
	/** The fault being fixed; club form is the absence of one. */
	preset: Exclude<PresetId, 'club'> | null;
};

export const INITIAL_STATE: RunLabState = {
	pace: 10,
	dials: TERRAIN_IDEALS.riverside,
	terrain: 'riverside',
	breath: '3-2',
	top: 'component',
	ghost: true,
	scrub: { on: false, phase: 0.25 },
	cameraView: 'side',
	preset: null,
};

export type RunLabAction =
	| { type: 'setPace'; value: number }
	| { type: 'setDial'; id: DialId; value: number }
	| { type: 'setTerrain'; terrain: Terrain }
	| { type: 'setBreath'; breath: BreathId }
	| { type: 'setTop'; top: TopId }
	| { type: 'setGhost'; on: boolean }
	| { type: 'setScrub'; on?: boolean; phase?: number }
	| { type: 'setCameraView'; view: CameraView | null }
	| { type: 'focusDial'; id: DialId }
	| { type: 'loadPreset'; id: PresetId };

export function reducer(state: RunLabState, action: RunLabAction): RunLabState {
	switch (action.type) {
		case 'setPace':
			return { ...state, pace: clamp(action.value, 0, 100) };
		case 'setDial':
			return {
				...state,
				dials: { ...state.dials, [action.id]: clamp(action.value, 0, 100) },
			};
		case 'setTerrain':
			return { ...state, terrain: action.terrain };
		case 'setBreath':
			return { ...state, breath: action.breath };
		case 'setTop':
			return { ...state, top: action.top };
		case 'setGhost':
			return { ...state, ghost: action.on };
		case 'setScrub':
			return {
				...state,
				scrub: {
					on: action.on ?? state.scrub.on,
					phase:
						action.phase === undefined ? state.scrub.phase : mod(action.phase),
				},
			};
		case 'setCameraView':
			return { ...state, cameraView: action.view };
		case 'focusDial':
			// Only while focus-follow is armed: a hand-orbited camera stays put.
			return state.cameraView === null
				? state
				: { ...state, cameraView: DIAL_VIEWS[action.id] };
		case 'loadPreset':
			return {
				...state,
				dials: presetDials(action.id, state.terrain),
				preset: action.id === 'club' ? null : action.id,
			};
	}
}
