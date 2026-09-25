import type { Stances } from './gait';
import type { ClipName } from './rig';
import type { RunLabState } from './state';

export type PlayheadSnapshot = { phase: number; step: number };

/**
 * The bridge from the scene's frame loop to the few DOM readouts that follow
 * it (scrub thumb, phase word, breath trace). The loop writes every frame; the
 * store notifies at most every `intervalMs`, so React re-renders those
 * readouts a dozen times a second rather than sixty, and the rest of the page
 * not at all.
 */
export function createPlayhead(intervalMs = 80) {
	let snapshot: PlayheadSnapshot = { phase: 0, step: 0 };
	let lastEmit = -Infinity;
	const listeners = new Set<() => void>();
	return {
		get: () => snapshot,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		/** `now` is a timestamp in ms; `force` skips the throttle. */
		set(phase: number, step: number, now: number, force = false) {
			if (snapshot.phase === phase && snapshot.step === step) return;
			if (!force && now - lastEmit < intervalMs) return;
			lastEmit = now;
			snapshot = { phase, step };
			for (const listener of listeners) listener();
		},
	};
}

export type Playhead = ReturnType<typeof createPlayhead>;

/** What the scene learns from the model once it has sampled its clips. */
export type GaitInfo = { stances: Record<ClipName, Stances> };

/**
 * Props of the lazily loaded scene. Declared here, outside the scene folder,
 * so the page shell can type them without importing anything that pulls
 * three.js into its graph.
 */
export type RunLabSceneProps = {
	state: RunLabState;
	/** Hold the stride at `state.scrub.phase` (scrubbing, or reduced motion). */
	hold: boolean;
	reduce: boolean;
	frameloop: 'always' | 'demand' | 'never';
	/** Every dial inside the ideal zone: the Pacer fades into the runner. */
	fixed: boolean;
	isDesktop: boolean;
	playhead: Playhead;
	onReady: (gait: GaitInfo) => void;
	onFailed: () => void;
	onOrbit: () => void;
};
