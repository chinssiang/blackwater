'use client';

import {
	Carousel,
	CarouselContent,
	CarouselNext,
	CarouselPrevious,
} from '@/components/ui/Carousel';

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
// Reduced motion is the primitive's business now, not this file's.

type EventsCarouselProps = {
	label: string;
	previousLabel: string;
	nextLabel: string;
	children: React.ReactNode;
};

// Buttons sit in their own row under the strip rather than at the primitive's
// default `-left-12`/`-right-12`, which would put them outside `px-contain` and
// under the page edge. `static left-auto right-auto my-0` is what tailwind-merge
// needs to drop the absolute positioning the defaults bring.
const NAV_BUTTON =
	'static left-auto right-auto my-0 size-9 pointer-coarse:size-11';

export default function EventsCarousel({
	label,
	previousLabel,
	nextLabel,
	children,
}: EventsCarouselProps) {
	return (
		<Carousel opts={{ align: 'start', dragFree: true }} aria-label={label}>
			<CarouselContent>{children}</CarouselContent>
			<div className="mt-4 flex justify-end gap-2">
				<CarouselPrevious label={previousLabel} className={NAV_BUTTON} />
				<CarouselNext label={nextLabel} className={NAV_BUTTON} />
			</div>
		</Carousel>
	);
}
