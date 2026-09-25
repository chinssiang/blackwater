import type { CameraView, DialId } from './types';

type Vec3 = readonly [number, number, number];

/**
 * Camera position per view. The runner faces +Z with its left at +X, so the
 * side view stands on the runner's RIGHT (-X): from there it runs left to
 * right, the way a page reads. Targets sit below the hips so the whole body,
 * feet included, clears the scrub bar at the bottom of the stage.
 */
export const CAMERA_VIEWS: Record<
	CameraView,
	{ position: Vec3; target: Vec3 }
> = {
	side: { position: [-5.6, 1.3, 0.3], target: [0, 0.78, 0] },
	front: { position: [-0.4, 1.35, 5.6], target: [0, 0.82, 0] },
	behind: { position: [0.3, 1.6, -5.6], target: [0, 0.85, 0] },
	quarter: { position: [-4.1, 1.55, 3.9], target: [0, 0.85, 0] },
};

/** The view that shows each dial best; the camera swings there on focus. */
export const DIAL_VIEWS: Record<DialId, CameraView> = {
	lean: 'side',
	footstrike: 'side',
	arms: 'front',
	shoulders: 'quarter',
	gaze: 'side',
	bounce: 'behind',
};
