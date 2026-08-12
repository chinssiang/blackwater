'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { ShopifyImage } from '@/lib/shopify/types';
import { cn } from '@/lib/utils';
import { interpolate } from '@/lib/dictionary';
import { useTranslations } from '@/components/LocaleProvider';
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
	useCarousel,
} from '@/components/ui/Carousel';

// Shopify's product images, browsable inside the product page's image frame.
// Rendered only when Shopify actually returned images — every other case
// (unlinked product, unknown handle, Shopify unreachable) falls back to the
// Sanity mainImage in ProductGalleryColumn, so this component never has to
// reason about an empty state.

type Props = {
	images: ShopifyImage[];
	/** Product title, already stegaClean'd — only feeds the alt-text fallback. */
	product: string;
};

// Shared by the carousel and the single-image case so the two produce identical
// markup: with one image there is nothing to browse, and paying for embla would
// also make the LCP element differ from the Suspense fallback it replaces.
function GallerySlide({
	image,
	alt,
	priority,
	eager,
}: {
	image: ShopifyImage;
	alt: string;
	priority: boolean;
	/**
	 * Loads a slide the shopper hasn't reached yet. Off-screen slides are clipped
	 * by the viewport's overflow-hidden, so IntersectionObserver never reports
	 * them visible and a lazy one only starts downloading once the scroll toward
	 * it begins — leaving the frame blank for the length of that fetch. Never set
	 * together with `priority`: next/image rejects both at once.
	 */
	eager?: boolean;
}) {
	return (
		// Same positioned wrapper, and the same reason, as ProductMainImage: `fill`
		// resolves inset:0 against the containing block's padding box, so padding
		// on an ancestor would never inset the image.
		<div className="absolute inset-6 lg:inset-10">
			<Image
				src={image.url}
				alt={alt}
				fill
				sizes="(max-width: 1024px) 100vw, 58vw"
				priority={priority}
				loading={eager ? 'eager' : undefined}
				className="object-contain"
			/>
		</div>
	);
}

// Above this count the dot row is replaced by a compact counter — see the note
// at the switch below. Six 44px targets plus gaps still fit the narrowest frame.
const MAX_DOTS = 6;

// Not exported into ui/Carousel.tsx: the carousel context deliberately exposes
// only `api`, and this is its one consumer.
function CarouselDots({
	goTo,
	slide,
}: {
	goTo: (index: number) => string;
	slide: (index: number) => string;
}) {
	const { api } = useCarousel();
	const [snaps, setSnaps] = useState<number[]>([]);
	const [selected, setSelected] = useState(0);

	useEffect(() => {
		if (!api) return;
		const sync = () => {
			setSnaps(api.scrollSnapList());
			setSelected(api.selectedScrollSnap());
		};
		sync();
		api.on('select', sync);
		// reInit fires on resize and whenever `opts` changes — including the
		// reduced-motion flip below, which can only resolve after mount.
		api.on('reInit', sync);
		return () => {
			api.off('select', sync);
			api.off('reInit', sync);
		};
	}, [api]);

	// Empty until embla initialises. The row is absolutely positioned, so
	// appearing on hydration shifts nothing.
	if (snaps.length <= 1) return null;

	// Past this many images the dots stop fitting: each is a 44px touch target on
	// a frame only ~345px wide at 375px, so the row wraps and the second line
	// covers the bottom of the photo. Digits and a slash carry no language, and
	// each slide already exposes its position to assistive tech through its own
	// aria-label, so the counter is decoration.
	if (snaps.length > MAX_DOTS) {
		return (
			<div
				aria-hidden
				className="t-l-2 absolute right-3 bottom-2 z-10 rounded-full bg-background/80 px-2 py-0.5 tabular-nums text-foreground/70"
			>
				{selected + 1} / {snaps.length}
			</div>
		);
	}

	return (
		<div className="absolute inset-x-0 bottom-1 z-10 flex items-center justify-center gap-1">
			{snaps.map((_, i) => (
				<button
					key={i}
					type="button"
					// Opts this button into Carousel's arrow-key allowlist, which is
					// otherwise limited to the primitive's own parts.
					data-slot="carousel-dot"
					onClick={() => api?.scrollTo(i)}
					aria-label={i === selected ? slide(i) : goTo(i)}
					aria-current={i === selected ? 'true' : undefined}
					className="flex size-8 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-11"
				>
					{/* The dot is decoration; the button around it is the 44px target. */}
					<span
						aria-hidden
						className={cn(
							'size-1.5 rounded-full bg-foreground/25 transition-all',
							i === selected && 'w-4 bg-foreground'
						)}
					/>
				</button>
			))}
		</div>
	);
}

export default function ProductGallery({ images, product }: Props) {
	const gallery = useTranslations('products').gallery;
	const reduce = useReducedMotion() ?? false;

	// embla animates with JS transforms, so a CSS media query can't reach it —
	// zero duration is the only way to honour the preference.
	const opts = useMemo(
		// loop: false keeps the arrows' disabled states meaningful at both ends.
		() => ({ loop: false, duration: reduce ? 0 : 25 }),
		[reduce]
	);

	// altText is null on effectively every Shopify image, so this is the primary
	// path rather than a fallback. `||`, not `??`: alt text cleared through the
	// Admin API comes back as "" rather than null, and alt="" would mark the
	// photograph decorative and hide it from screen readers entirely.
	const altFor = (image: ShopifyImage, index: number) =>
		image.altText ||
		interpolate(gallery.imageAlt, {
			product,
			index: index + 1,
			count: images.length,
		});

	if (images.length === 1) {
		return <GallerySlide image={images[0]} alt={altFor(images[0], 0)} priority />;
	}

	return (
		<Carousel className="absolute inset-0" opts={opts} aria-label={gallery.label}>
			{/* ml-0 / pl-0 drop the primitive's inter-slide gutter: these slides are
			    full-bleed within the frame, so a gutter would reveal the edge of the
			    neighbouring image while dragging. */}
			<CarouselContent className="ml-0">
				{images.map((image, i) => (
					// aspect-4/3 is what gives the carousel its height — CarouselContent's
					// embla viewport takes no className, and h-full on a slide would
					// collapse against that auto-height viewport. Keep this ratio in step
					// with the frame in PageProductSingle; if they drift the slide only
					// letterboxes inside an overflow-hidden box, never shifting layout.
					<CarouselItem
						key={image.url}
						className="relative aspect-4/3 pl-0"
						aria-label={interpolate(gallery.slide, {
							index: i + 1,
							count: images.length,
						})}
					>
						<GallerySlide
							image={image}
							alt={altFor(image, i)}
							priority={i === 0}
							// Only the next slide, not the whole set: it is the one the
							// first swipe or arrow click reveals, and most products here
							// have exactly two images.
							eager={i === 1}
						/>
					</CarouselItem>
				))}
			</CarouselContent>
			{/* `label` localizes the arrows' screen-reader text, which is otherwise
			    English. left/right-3 pull them in from their default position
			    outside the frame. */}
			<CarouselPrevious
				label={gallery.previous}
				className="left-3 size-9 pointer-coarse:size-11"
			/>
			<CarouselNext
				label={gallery.next}
				className="right-3 size-9 pointer-coarse:size-11"
			/>
			<CarouselDots
				goTo={(i) => interpolate(gallery.goTo, { index: i + 1 })}
				slide={(i) =>
					interpolate(gallery.slide, { index: i + 1, count: images.length })
				}
			/>
		</Carousel>
	);
}
