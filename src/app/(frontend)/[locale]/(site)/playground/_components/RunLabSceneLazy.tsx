'use client';

import { Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { RunLabSceneProps } from '@/lib/run-lab/playhead';

// The lazy boundary for the 3D scene, and the ONLY import path to ./scene/*:
// three.js and react-three-fiber are ~200KB gzip, and a static import of the
// scene anywhere in the client graph would pull them into a shared chunk. A
// `dynamic()` inside a 'use client' file is a real import(), so the chunk is
// requested only on /playground (the HeroWaveLazy note says why it has to be a
// client file). `src/lib/run-lab/run-lab-isolation.test.ts` holds this.
//
// `ssr: false` because a WebGL canvas has nothing to prerender, and the shell
// paints the loading state itself. `loading` gives the import its own Suspense
// boundary so the chunk never gates hydration of the page around it.
const LazyScene = dynamic(
	() => import('./scene/RunLabScene').then((m) => m.RunLabScene),
	{ ssr: false, loading: () => null }
);

// A failed chunk fetch, a browser with no WebGL, or a context that could not
// be created all land here. The page still teaches without the runner -- every
// dial keeps its note -- so the shell switches to its fallback copy rather
// than losing the page to an error screen.
class SceneBoundary extends Component<
	{ children: ReactNode; onFailed: () => void },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		console.error('[run-lab] scene failed to load', error);
		this.props.onFailed();
	}

	render() {
		return this.state.failed ? null : this.props.children;
	}
}

export function RunLabScene(props: RunLabSceneProps) {
	return (
		<SceneBoundary onFailed={props.onFailed}>
			<LazyScene {...props} />
		</SceneBoundary>
	);
}
