'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Over a full-bleed hero the header is fully solid once this fraction of the
// hero has scrolled out, not at the very last pixel: waiting for the end reads
// as the header lagging behind content that has already gone.
const HEADER_SOLID_AT = 0.36;

// The wave hero's background wrapper when it opens the page, and the owner of
// the header's scroll progress. The contract is the `[data-site-header]` rules
// in globals.css: they read `--header-progress` (1 everywhere, 0 under this
// marker) and switch the blur on at `data-header-solid`. This component writes
// both onto the header for exactly as long as it is mounted, so a hero that
// appears or disappears without a route change -- draft-mode live updates
// re-render the page in place -- attaches and detaches with it, which a
// pathname-keyed effect in the Header could not do.
//
// The range is measured before the scroll listener attaches and floored at 1,
// so no scroll event can divide by an unmeasured, zero or negative range (NaN
// written into the registered property would compute to its initial value, a
// solid header over the hero). It is also capped to the document's reachable
// scroll: a page with little content below a viewport-tall hero could
// otherwise never reach the solid state.
export function HeroUnderlay({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const hero = ref.current;
		const header = document.querySelector<HTMLElement>('[data-site-header]');
		if (!hero || !header) return;

		let range = 1;
		let last = -1;
		const update = () => {
			// Math.max: iOS rubber-banding reports a negative scrollY, and a
			// negative percentage would invalidate the colour-mix.
			const progress = Math.min(1, Math.max(0, window.scrollY / range));
			const step = Math.round(progress * 1000);
			if (step === last) return;
			last = step;
			header.style.setProperty('--header-progress', String(step / 1000));
			header.toggleAttribute('data-header-solid', step === 1000);
		};
		const measure = () => {
			range = Math.max(
				1,
				(hero.offsetHeight - header.offsetHeight) * HEADER_SOLID_AT
			);
			const reachable =
				document.documentElement.scrollHeight - window.innerHeight;
			if (reachable > 0) range = Math.min(range, reachable);
			update();
		};

		measure();
		const resizeObserver = new ResizeObserver(measure);
		resizeObserver.observe(hero);
		resizeObserver.observe(document.body);
		window.addEventListener('resize', measure);
		window.addEventListener('scroll', update, { passive: true });
		return () => {
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', measure);
			resizeObserver.disconnect();
			header.style.removeProperty('--header-progress');
			header.removeAttribute('data-header-solid');
		};
	}, []);

	return (
		<div
			ref={ref}
			aria-hidden
			data-hero-underlay=""
			className="absolute inset-0 -z-10"
		>
			{children}
		</div>
	);
}
