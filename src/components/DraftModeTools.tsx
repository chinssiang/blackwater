'use client';

import { lazy, Suspense } from 'react';

/**
 * Client-side gate so the Visual Editing bundle is fetched only in draft mode.
 *
 * Why a client `React.lazy` and not `next/dynamic` in the server component:
 * both defer *execution*, but a client reference held by the server tree is
 * still listed in the route's client manifest and gets loaded with the page.
 * Measured — with `next/dynamic` in HtmlShell the chunk (@sanity/comlink and its
 * channel/overlay code) was still downloaded on published traffic: ~23KB
 * transferred, 99% unused. A `lazy()` inside a client component that returns
 * null before the flag is true produces a genuine on-demand fetch.
 */
const DraftModeToolsInner = lazy(
	() => import('@/components/DraftModeToolsInner')
);

export default function DraftModeTools({ enabled }: { enabled: boolean }) {
	if (!enabled) return null;
	return (
		<Suspense fallback={null}>
			<DraftModeToolsInner />
		</Suspense>
	);
}
