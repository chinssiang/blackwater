'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';

// The lazy boundary for the wave canvas -- and it has to be a CLIENT file to be
// one. HeroBlock is a Server Component, and `next/dynamic` called from a Server
// Component does not code-split on the client: the module just becomes another
// client reference of the route, and Turbopack folded it into the homepage and
// /[slug] route chunks. Measured on a production build: with the dynamic() in
// HeroBlock itself, both the zh_tw homepage (no wave) and /en/about shipped the
// canvas code. A dynamic() inside a 'use client' module is a real import() in
// the client graph, so the chunk is requested only where this actually renders.
// Same arrangement as LocationCurrentTimeLazy.
//
// Keep this file the sole route to ui/HeroWave: a static import of the
// primitive anywhere in the static client graph pulls it straight back in.
//
// SSR stays on (unlike the clock wrapper): the server-rendered canvas is empty
// and harmless, and rendering it lets Next preload the chunk on the one page
// that needs it instead of discovering it after hydration. `loading` is what
// gives the lazy component its own Suspense boundary -- with ssr on and no
// loading option, next/dynamic renders a bare Fragment, and with no boundary
// anywhere above, the chunk would gate the root hydration commit and hold
// client navigations to the homepage until it arrived.
const LazyWave = dynamic(
	() => import('@/components/ui/HeroWave').then((m) => m.HeroWave),
	{ loading: () => null }
);

// A failed chunk fetch (a deploy rotating asset hashes under an open tab, a
// flaky network) rejects the lazy import; with no error.tsx in the app the
// nearest catcher would be Next's built-in page, replacing the whole homepage
// for a decoration that is already aria-hidden. Render nothing instead. Same
// reasoning as CartDrawer's panel boundary.
class WaveBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		console.error('[hero] wave background failed to load', error);
	}

	render() {
		return this.state.failed ? null : this.props.children;
	}
}

export function HeroWave() {
	return (
		<WaveBoundary>
			<LazyWave />
		</WaveBoundary>
	);
}
