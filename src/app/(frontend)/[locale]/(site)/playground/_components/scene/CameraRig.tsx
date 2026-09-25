'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CAMERA_VIEWS } from '@/lib/run-lab/camera';
import type { CameraView } from '@/lib/run-lab/types';
import { DESKTOP_VIEW_SHIFT } from './constants';
import { type PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const TWEEN_RATE = 5;

/**
 * Orbit by hand, or swing to a named view. The swing eases toward the view
 * and stops the moment the visitor grabs the camera, and a hand orbit tells
 * the page (`onOrbit`), which stops dial focus from moving the camera until a
 * view is picked again -- so the camera is never yanked back.
 *
 * Orbit only: zoom and pan are off, so the wheel and a one-finger vertical
 * swipe still scroll the page.
 */
export function CameraRig({
	view,
	reduce,
	isDesktop,
	onOrbit,
}: {
	view: CameraView | null;
	reduce: boolean;
	isDesktop: boolean;
	onOrbit: () => void;
}) {
	// Mutates three.js objects inside useFrame; see eslint.config.mjs.
	'use no memo';
	const camera = useThree((s) => s.camera) as PerspectiveCamera;
	const gl = useThree((s) => s.gl);
	const size = useThree((s) => s.size);
	const invalidate = useThree((s) => s.invalidate);
	const controlsRef = useRef<OrbitControls | null>(null);
	const tweenRef = useRef<{ position: Vector3; target: Vector3 } | null>(null);
	const onOrbitRef = useRef(onOrbit);

	useEffect(() => {
		onOrbitRef.current = onOrbit;
	});

	useEffect(() => {
		const controls = new OrbitControls(camera, gl.domElement);
		controls.enableZoom = false;
		controls.enablePan = false;
		controls.rotateSpeed = 0.6;
		controls.minPolarAngle = Math.PI * 0.28;
		controls.maxPolarAngle = Math.PI * 0.54;
		controls.target.set(...CAMERA_VIEWS.side.target);
		// OrbitControls claims every touch (`touch-action: none`); hand vertical
		// swipes back to the browser so the page still scrolls on a phone.
		gl.domElement.style.touchAction = 'pan-y';
		const onStart = () => {
			tweenRef.current = null;
			onOrbitRef.current();
		};
		const onChange = () => invalidate();
		controls.addEventListener('start', onStart);
		controls.addEventListener('change', onChange);
		controls.update();
		controlsRef.current = controls;
		return () => {
			controls.removeEventListener('start', onStart);
			controls.removeEventListener('change', onChange);
			controls.dispose();
			controlsRef.current = null;
		};
	}, [camera, gl, invalidate]);

	useEffect(() => {
		const controls = controlsRef.current;
		if (controls) controls.enableDamping = !reduce;
	}, [reduce]);

	useEffect(() => {
		if (!view) return;
		const { position, target } = CAMERA_VIEWS[view];
		const next = {
			position: new Vector3(...position),
			target: new Vector3(...target),
		};
		const controls = controlsRef.current;
		if (reduce && controls) {
			// Reduced motion cuts to the view instead of swinging.
			camera.position.copy(next.position);
			controls.target.copy(next.target);
			controls.update();
			tweenRef.current = null;
		} else {
			tweenRef.current = next;
		}
		invalidate();
	}, [view, reduce, camera, invalidate]);

	// On desktop the panel covers the right of the stage, so shift the picture
	// left rather than moving the camera: the runner stays centred on its own
	// axis for orbiting.
	useEffect(() => {
		if (isDesktop) {
			camera.setViewOffset(
				size.width,
				size.height,
				size.width * DESKTOP_VIEW_SHIFT,
				0,
				size.width,
				size.height
			);
		} else {
			camera.clearViewOffset();
		}
		invalidate();
	}, [camera, size.width, size.height, isDesktop, invalidate]);

	useFrame((_, delta) => {
		const controls = controlsRef.current;
		if (!controls) return;
		const tween = tweenRef.current;
		if (tween) {
			const k = 1 - Math.exp(-TWEEN_RATE * Math.min(delta, 0.1));
			camera.position.lerp(tween.position, k);
			controls.target.lerp(tween.target, k);
			if (
				camera.position.distanceToSquared(tween.position) < 1e-5 &&
				controls.target.distanceToSquared(tween.target) < 1e-5
			) {
				tweenRef.current = null;
			}
			invalidate();
		}
		controls.update(Math.min(delta, 0.1));
	});

	return null;
}
