'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { breathStateAt } from '@/lib/run-lab/breath';
import { CAMERA_VIEWS } from '@/lib/run-lab/camera';
import { computeOverrides } from '@/lib/run-lab/dials';
import { footfallsCrossed } from '@/lib/run-lab/gait';
import { DEG } from '@/lib/run-lab/math';
import { paceProfile } from '@/lib/run-lab/pace';
import type { RunLabSceneProps } from '@/lib/run-lab/playhead';
import { CLIP_NAMES, type ClipName, RUNNER_MODEL_URL } from '@/lib/run-lab/rig';
import { TERRAIN_IDEALS, TERRAIN_SLOPE_DEG } from '@/lib/run-lab/terrain';
import { DEFAULT_GAIT } from '../playground-shared';
import { Backdrop } from './Backdrop';
import { CameraRig } from './CameraRig';
import { Ground } from './Ground';
import {
	BACKGROUND,
	FOG_FAR,
	FOG_NEAR,
	GHOST,
	GHOST_FADE_S,
	GHOST_OPACITY,
	RUNNER,
} from './constants';
import {
	type ClipTiming,
	applyOverrides,
	createRig,
	measureClips,
	poseClips,
	stepCloth,
	wearTop,
} from './runner-rig';
import {
	DataTexture,
	type Group,
	MeshBasicMaterial,
	MeshStandardMaterial,
	RGBAFormat,
	Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * The 3D half of Run Lab. Reached ONLY through RunLabSceneLazy, which is what
 * keeps three.js in this route's own chunk.
 */
export function RunLabScene(props: RunLabSceneProps) {
	const { frameloop, onFailed } = props;
	return (
		<Canvas
			frameloop={frameloop}
			dpr={[1, 1.5]}
			gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
			camera={{
				fov: 30,
				near: 0.1,
				// Past the backdrop ring.
				far: 200,
				position: [...CAMERA_VIEWS.side.position],
			}}
			resize={{ scroll: false }}
			onCreated={({ gl }) => {
				gl.setClearColor(BACKGROUND, 0);
			}}
			style={{ position: 'absolute', inset: 0 }}
		>
			<fog attach="fog" args={[BACKGROUND, FOG_NEAR, FOG_FAR]} />
			<hemisphereLight args={['#e8e8e8', '#1a1a1a', 1.7]} />
			<directionalLight position={[3, 6, 4]} intensity={1.6} />
			<directionalLight position={[-4, 3, -3]} intensity={0.35} />
			{/* A rim from the far side, so black fabric keeps its silhouette
			    against the near-black page. */}
			<directionalLight position={[5, 4, -2]} intensity={1.3} />
			{/* Outside World's tilt: the far horizon stays level on a hill. */}
			<Backdrop terrain={props.state.terrain} />
			<Suspense fallback={null}>
				<World {...props} />
			</Suspense>
			<CameraRig
				view={props.state.cameraView}
				reduce={props.reduce}
				isDesktop={props.isDesktop}
				onOrbit={props.onOrbit}
			/>
			<ContextLoss onLost={onFailed} />
		</Canvas>
	);
}

/**
 * A GPU context lost while the page is up means no runner: show the copy-only
 * page. Listening from inside the Canvas means the listener is removed in an
 * effect cleanup, which R3F runs before its own teardown forces a context
 * loss (on unmount, StrictMode's double mount, HMR), so that one never counts.
 */
function ContextLoss({ onLost }: { onLost: () => void }) {
	const gl = useThree((s) => s.gl);
	useEffect(() => {
		const canvas = gl.domElement;
		const lost = (e: Event) => {
			e.preventDefault();
			onLost();
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => canvas.removeEventListener('webglcontextlost', lost);
	}, [gl, onLost]);
	return null;
}

function World(props: RunLabSceneProps) {
	// Mutates three.js objects inside useFrame; see eslint.config.mjs.
	'use no memo';
	const gltf = useLoader(GLTFLoader, RUNNER_MODEL_URL);
	const invalidate = useThree((s) => s.invalidate);

	const runner = useMemo(
		() =>
			createRig(
				gltf,
				() =>
					new MeshStandardMaterial({
						color: RUNNER,
						// Clay rather than plastic: a soft sheen that shows the
						// muscle forms without reading as skin.
						roughness: 0.6,
						metalness: 0,
					}),
				{ kit: true }
			),
		[gltf]
	);
	const ghost = useMemo(
		() =>
			createRig(
				gltf,
				() =>
					new MeshStandardMaterial({
						color: GHOST,
						roughness: 1,
						transparent: true,
						opacity: 0,
						depthWrite: false,
						// Pulled toward the camera, so where the Pacer and the runner
						// coincide the Pacer wins cleanly instead of shimmering.
						polygonOffset: true,
						polygonOffsetFactor: -1,
						polygonOffsetUnits: -4,
					}),
				{ kit: false }
			),
		[gltf]
	);
	const timing = useMemo(() => measureClips(runner), [runner]);
	const shadow = useMemo(() => createShadowMaterial(), []);

	// Everything the loop reads comes through this ref, written after each
	// render and read only inside useFrame: the loop never sees a stale prop,
	// and React never re-renders for a frame.
	const latest = useRef(props);
	useEffect(() => {
		latest.current = props;
		// The loop reads props through this ref, so no prop change asks R3F for
		// a frame by itself; under frameloop="demand" every render must.
		invalidate();
	});

	const phase = useRef(props.state.scrub.phase);
	const steps = useRef(0);
	const groundOffset = useRef(0);
	const drag = useMemo(() => new Vector3(), []);
	const tilt = useRef<Group>(null);

	const footfalls = useMemo(() => {
		const run = timing.run ?? Object.values(timing)[0];
		return run ? [run.stances.left[0], run.stances.right[0]] : [0, 0.5];
	}, [timing]);

	useEffect(() => {
		const stances = Object.fromEntries(
			CLIP_NAMES.map((name) => [
				name,
				timing[name]?.stances ?? DEFAULT_GAIT.stances[name],
			])
		) as Record<ClipName, ClipTiming['stances']>;
		latest.current.onReady({ stances });
		// Pose once now: under frameloop="never" (a hidden tab) R3F can still
		// paint on resize without running useFrame, which would show a fresh
		// rig in its bind pose.
		const { state } = latest.current;
		const { weights } = paceProfile(state.pace);
		poseClips(runner, state.scrub.phase, weights, timing);
		applyOverrides(runner, computeOverrides(state.dials, state.scrub.phase), 0);
		wearTop(runner, state.top);
		invalidate();
	}, [timing, footfalls, invalidate, runner]);

	useFrame((_, rawDelta) => {
		const p = latest.current;
		const delta = Math.min(rawDelta, 0.1);
		const profile = paceProfile(p.state.pace);
		const cycleSeconds = 120 / profile.cadenceSpm;

		// Ground speed from the clips themselves: how far the planted foot rolls
		// back in a stride, so the feet do not skate.
		let speed = 0;
		for (const name of CLIP_NAMES) {
			const t = timing[name];
			if (t) speed += profile.weights[name] * (t.stride / cycleSeconds);
		}
		if (p.hold) {
			phase.current = p.state.scrub.phase;
		} else {
			const prev = phase.current;
			phase.current = (prev + delta / cycleSeconds) % 1;
			steps.current += footfallsCrossed(prev, phase.current, footfalls);
			groundOffset.current += speed * delta;
		}

		const stepPhase = (phase.current * 2) % 1;
		const breath = breathStateAt(steps.current, stepPhase, p.state.breath);

		poseClips(runner, phase.current, profile.weights, timing);
		applyOverrides(
			runner,
			computeOverrides(p.state.dials, phase.current),
			breath.level
		);
		wearTop(runner, p.state.top);
		// Air streams past toward -Z (the way the ground moves), and a hem
		// trails it a little further the faster the pace.
		drag.set(0, 0, -Math.min(0.03, speed * 0.006));
		stepCloth(runner, delta, drag, p.hold || p.reduce);

		// The Pacer is visible only while the runner is off the ideal: matching it
		// is what makes it fade into you. Hidden and not fading in, it is not
		// posed at all, which is most of the time: the page opens on club form.
		const target = p.state.ghost && !p.fixed ? GHOST_OPACITY : 0;
		const material = ghost.materials[0] as MeshStandardMaterial | undefined;
		if (material && (target > 0 || material.opacity > 0)) {
			const ideal = TERRAIN_IDEALS[p.state.terrain];
			poseClips(ghost, phase.current, profile.weights, timing);
			applyOverrides(
				ghost,
				computeOverrides(ideal, phase.current),
				breath.level
			);
			const step = p.reduce ? 1 : (delta / GHOST_FADE_S) * GHOST_OPACITY;
			const current = material.opacity;
			const next =
				current < target
					? Math.min(target, current + step)
					: Math.max(target, current - step);
			for (const m of ghost.materials)
				(m as MeshStandardMaterial).opacity = next;
			ghost.root.visible = next > 0.001;
			if (next !== target) invalidate();
		}

		if (tilt.current)
			tilt.current.rotation.x = -TERRAIN_SLOPE_DEG[p.state.terrain] * DEG;
		p.playhead.set(phase.current, steps.current, performance.now(), p.hold);
	});

	return (
		<group ref={tilt}>
			<Ground terrain={props.state.terrain} offsetRef={groundOffset} />
			<mesh
				rotation-x={-Math.PI / 2}
				position={[0, 0.006, 0]}
				material={shadow}
			>
				<circleGeometry args={[0.5, 32]} />
			</mesh>
			<primitive object={runner.root} />
			<primitive object={ghost.root} renderOrder={1} />
		</group>
	);
}

/** A soft radial shadow under the runner: cheaper than any shadow map. */
function createShadowMaterial() {
	const size = 64;
	const data = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
			const a = Math.max(0, 1 - d);
			data.set([0, 0, 0, Math.round(a * a * 150)], (y * size + x) * 4);
		}
	}
	const texture = new DataTexture(data, size, size, RGBAFormat);
	texture.needsUpdate = true;
	return new MeshBasicMaterial({
		map: texture,
		transparent: true,
		depthWrite: false,
	});
}
