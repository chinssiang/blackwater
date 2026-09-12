'use client';

import dynamic from 'next/dynamic';

// The clock is rendered from two places in the always-mounted chrome — the
// desktop Header row and the MobileMenu panel — but only on /events*. A static
// import from either one puts `@date-fns/tz`, `date-fns`'s `format` and BOTH
// `enUS`/`zhTW` locale bundles into the shared chunk of every route.
//
// BOTH call sites must go through this wrapper. Splitting only one removes
// nothing, because the module stays reachable from the always-loaded graph via
// the other (measured on a production build: −61KB and −2 chunks off every
// route only once both sites were routed here).
//
// `ssr: false`, like the sibling wrappers (CartDrawer, ProductSubmissionLazy),
// and here it is doubly right: without it, `next/dynamic` server-renders the
// clock, and on these prerendered routes (`revalidate: false`) that bakes the
// BUILD-TIME minute into the HTML — a visitor sees a clock that is stale by
// however old the deploy is until hydration's next minute-tick corrects it.
// Client-only rendering trades that lie for a placeholder.
//
// The placeholder carries the same `min-w-[15ch]` as the real <time> element
// so the swap is width-stable — see the note on the element in
// LocationCurrentTime.tsx for how that width was chosen.
export const LocationCurrentTime = dynamic(
	() =>
		import('./LocationCurrentTime').then((m) => m.LocationCurrentTime),
	{
		ssr: false,
		loading: () => (
			<span aria-hidden className="inline-block min-w-[15ch]" />
		),
	}
);
