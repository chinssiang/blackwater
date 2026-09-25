import type { Dictionary } from '@/lib/dictionary';
import { paceProfile } from '@/lib/run-lab/pace';
import type { GaitInfo } from '@/lib/run-lab/playhead';
import type { ClipName } from '@/lib/run-lab/rig';
import type { DialId, PresetId } from '@/lib/run-lab/types';

export type PlaygroundCopy = Dictionary['playground'];

export const PANEL_TABS = ['runner', 'ground', 'breath', 'kit', 'fix'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

/** What the note slot is currently explaining. One slot, one note. */
export type Note =
	| { kind: 'intro' }
	| { kind: 'pace' }
	| { kind: 'dial'; id: DialId }
	| { kind: 'terrain' }
	| { kind: 'breath' }
	| { kind: 'kit' }
	| { kind: 'preset'; id: PresetId }
	| { kind: 'fixed' }
	| { kind: 'phase' }
	| { kind: 'pacer' };

/**
 * Stance windows before the model has been sampled (and when it never will
 * be, with no WebGL), matching the stand-in rig's authored timing so the scrub
 * labels read right either way.
 */
export const DEFAULT_GAIT: GaitInfo = {
	stances: {
		jog: { left: [0, 0.4], right: [0.5, 0.9] },
		run: { left: [0, 0.34], right: [0.5, 0.84] },
		sprint: { left: [0, 0.27], right: [0.5, 0.77] },
	},
};

export function dominantClip(pace: number): ClipName {
	const { weights } = paceProfile(pace);
	return (Object.keys(weights) as ClipName[]).reduce((a, b) =>
		weights[b] > weights[a] ? b : a
	);
}
