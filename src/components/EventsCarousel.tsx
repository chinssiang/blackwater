'use client';

import { useCallback, useRef } from 'react';

import {
	Carousel,
	CarouselContent,
	CarouselNext,
	CarouselPrevious,
} from '@/components/ui/Carousel';
import { cn, SECTION_INSET, SECTION_INSET_START } from '@/lib/utils';

// The client half of the upcoming-events strip. <EventsBlock> stays a Server
// Component and passes the rendered tickets in as `children`, so no ticket
// markup crosses into the browser bundle.
//
// This file exists to be a LAZY BOUNDARY, not just a wrapper. PageModules
// statically imports EventsBlock for every page that can carry modules -- the
// homepage and all ~380 `/[slug]` pages -- so a static import of the carousel
// primitive would put embla (~8KB gzip) into the shared client graph of every
// one of them, including the overwhelming majority carrying no eventsBlock at
// all. EventsBlock next/dynamic()s this module, which is only effective while
// this file is the sole route to `ui/Carousel`: importing CarouselItem directly
// into EventsBlock would pull the primitive straight back into the static graph.
// That is why the slides there are plain server-rendered divs.
//
// Measured 2026-09-03 on a production build, the paragraph above does not
// hold: a dynamic() called from a Server Component does not code-split, and
// this file's code sits in the homepage and /[slug] route chunks on pages with
// no eventsBlock. A real boundary needs the dynamic() inside a 'use client'
// module -- see HeroWaveLazy.tsx for the working shape. Follow-up.
//
// Reduced motion is the primitive's business now, not this file's.

type EventsCarouselProps = {
	label: string;
	previousLabel: string;
	nextLabel: string;
	children: React.ReactNode;
};

// Buttons sit in their own row under the strip rather than at the primitive's
// default `-left-12`/`-right-12`, which would put them under the page edge.
// `static left-auto right-auto my-0` is what tailwind-merge needs to drop the
// absolute positioning the defaults bring.
const NAV_BUTTON =
	'static left-auto right-auto my-0 size-9 pointer-coarse:size-11';

export default function EventsCarousel({
	label,
	previousLabel,
	nextLabel,
	children,
}: EventsCarouselProps) {
	// The strip is full-bleed: `SECTION_INSET_START` is a padding on the TRACK,
	// not on `CarouselContent`'s `overflow-hidden` viewport, so tickets keep
	// running off both screen edges as they scroll rather than being clipped at
	// the inset. The cost is that the inset travels with the track.
	//
	// embla measures every snap as `containerRect.start - slideRect.start`, so a
	// leading track padding lands in snap 0 and in no other: `ScrollContain`
	// pins the first snap to the scroll bound, and every later snap puts its
	// group flush at x=0, hard against the screen edge. A custom `align` is the
	// lever -- embla adds its return value to every snap
	// (`ScrollSnaps.measureAligned`), so returning the inset restores it at each
	// one. Snap 0 stays put (`-inset + inset = 0`, and it is pinned to the bound
	// regardless) and the LAST snap is pinned to the opposite bound, which is
	// where `last:mr-contain` on the slide -- read as embla's end gap -- lands
	// the final ticket at the matching inset on the right.
	//
	// It is read back off the track rather than recomputed from `--padding-max`
	// in JS so the CSS stays the single definition; embla rebuilds its engine on
	// every resize, so this re-reads with it.
	const trackRef = useRef<HTMLDivElement>(null);
	const alignToInset = useCallback(() => {
		const track = trackRef.current;
		if (!track) return 0;
		return parseFloat(getComputedStyle(track).paddingLeft) || 0;
	}, []);

	// `dragFree` is deliberately NOT set. It is embla's opt-out of snapping: a
	// drag rests wherever momentum dies, which left a ticket half past the
	// viewport edge looking clipped. Off (the default), a drag settles on a snap
	// point.
	//
	// `slidesToScroll: 'auto'` makes each snap a full GROUP rather than one
	// slide, so a nav click advances by however many tickets currently fit --
	// four at `xl`, three at `lg`, one on the `basis-[78%]` mobile card --
	// without anyone restating the basis ladder here. embla derives the grouping
	// by measuring, and takes the track's leading padding and the last slide's
	// `mr-contain` into account as start/end gaps.
	//
	// `containScroll` is left at its `trimSnaps` default, which drops the snaps
	// that would scroll past the end -- that is what keeps the final group flush
	// with the trailing inset instead of over-scrolling into dead space.
	return (
		<Carousel
			opts={{ align: alignToInset, slidesToScroll: 'auto' }}
			aria-label={label}
		>
			{/* `gap-6` rather than the primitive's per-slide padding plus a
			    negative track margin: that idiom fights the leading inset, which has
			    to stay a real padding so the first ticket lines up with the heading.
			    `ml-0` drops the primitive's default `-ml-4` for the same reason. */}
			<CarouselContent
				ref={trackRef}
				className={cn(SECTION_INSET_START, 'ml-0 gap-6')}
			>
				{children}
			</CarouselContent>
			<div className={cn('mt-4 flex justify-end gap-2', SECTION_INSET)}>
				<CarouselPrevious label={previousLabel} className={NAV_BUTTON} />
				<CarouselNext label={nextLabel} className={NAV_BUTTON} />
			</div>
		</Carousel>
	);
}
