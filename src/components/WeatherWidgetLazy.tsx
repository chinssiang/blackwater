'use client';

import dynamic from 'next/dynamic';

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
export const WeatherWidget = dynamic(
	() => import('./WeatherWidget').then((m) => m.WeatherWidget),
	{ ssr: false }
);
