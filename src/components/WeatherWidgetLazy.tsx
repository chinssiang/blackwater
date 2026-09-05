'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';

// <Layout> is the always-mounted chrome, so a static import of the widget from
// there puts it — and `@/lib/weather` with it — into the shared chunk of every
// route, including the ~180 product and general pages that never render it.
// This wrapper is the same treatment LocationCurrentTimeLazy, HeroWaveLazy and
// ProductSubmissionLazy get, and for the same reason.
//
// `ssr: false`, and here it is not just convention: the widget has no data
// until its own fetch resolves in the browser, and these routes are prerendered
// (`revalidate: false`, or 3600 on three of them), so anything server-rendered
// into the corner would be a placeholder frozen into the HTML at build time.
//
// No `loading` placeholder, unlike the siblings: the widget occupies a fixed
// corner rather than a slot in a text row, so there is no layout to keep stable
// and a reserved empty box would only intercept pointer events over whatever
// sits beneath it.
const LazyWidget = dynamic(
	() => import('./WeatherWidget').then((m) => m.WeatherWidget),
	{ ssr: false }
);

// A failed chunk fetch (a deploy rotating asset hashes under an open tab, a
// flaky network) rejects the lazy import, and with no error.tsx in the app the
// nearest catcher is Next's built-in page -- replacing the whole route for
// ambient decoration. The widget's own docblock says an error belongs nowhere
// on screen, so render nothing. Same reasoning, and the same shape, as
// HeroWaveLazy's WaveBoundary and CartDrawer's panel boundary.
class WeatherBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		console.error('[WeatherWidget] failed to load', error);
	}

	render() {
		return this.state.failed ? null : this.props.children;
	}
}

export function WeatherWidget() {
	return (
		<WeatherBoundary>
			<LazyWidget />
		</WeatherBoundary>
	);
}
