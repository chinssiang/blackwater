/**
 * Run Lab (`/playground`) vocabulary. Every id here is also a dictionary key
 * under `playground`, so renaming one is a copy change in both locales.
 */

export const DIAL_IDS = [
	'lean',
	'footstrike',
	'arms',
	'shoulders',
	'gaze',
	'bounce',
] as const;
export type DialId = (typeof DIAL_IDS)[number];
/** Each dial is 0..100; the user only ever sees the zone word. */
export type Dials = Record<DialId, number>;
export type Zone = 'low' | 'ideal' | 'high';

export const TERRAIN_IDS = [
	'track',
	'riverside',
	'trail',
	'uphill',
	'downhill',
] as const;
export type Terrain = (typeof TERRAIN_IDS)[number];

export const BREATH_IDS = ['3-2', '2-2', '2-1'] as const;
export type BreathId = (typeof BREATH_IDS)[number];

export type PaceZone = 'easy' | 'steady' | 'tempo' | 'fast';

export const CAMERA_VIEW_IDS = ['side', 'front', 'behind', 'quarter'] as const;
export type CameraView = (typeof CAMERA_VIEW_IDS)[number];

export const PRESET_IDS = [
	'club',
	'heel',
	'bouncer',
	'shoulders',
	'arms',
	'sitter',
	'gazer',
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export type GaitPhase = 'contact' | 'midstance' | 'toeOff' | 'flight';
export type Side = 'left' | 'right';

/** A stance window in cycle phase [0,1); `end < start` means it wraps. */
export type Interval = readonly [start: number, end: number];

/** The four club tops the runner can wear; each is a dictionary key too. */
export const TOP_IDS = ['component', 'coda', 'hoole', 'communion'] as const;
export type TopId = (typeof TOP_IDS)[number];
