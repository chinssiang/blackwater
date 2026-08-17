'use client';

import * as React from 'react';
import useEmblaCarousel, {
	type UseEmblaCarouselType,
} from 'embla-carousel-react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
// `axis` is omitted deliberately: it is derived from the `orientation` prop and
// applied after this object is spread, so one passed through here would be
// silently discarded. Omitting it makes that a compile error instead.
type CarouselOptions = Omit<NonNullable<UseCarouselParameters[0]>, 'axis'>;
type CarouselPlugin = UseCarouselParameters[1];

type CarouselProps = {
	opts?: CarouselOptions;
	plugins?: CarouselPlugin;
	orientation?: 'horizontal' | 'vertical';
	setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
	carouselRef: ReturnType<typeof useEmblaCarousel>[0];
	api: ReturnType<typeof useEmblaCarousel>[1];
	scrollPrev: () => void;
	scrollNext: () => void;
	canScrollPrev: boolean;
	canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
	const context = React.useContext(CarouselContext);

	if (!context) {
		throw new Error('useCarousel must be used within a <Carousel />');
	}

	return context;
}

function Carousel({
	orientation = 'horizontal',
	opts,
	setApi,
	plugins,
	className,
	children,
	...props
}: React.ComponentProps<'div'> & CarouselProps) {
	const [carouselRef, api] = useEmblaCarousel(
		{
			...opts,
			axis: orientation === 'horizontal' ? 'x' : 'y',
		},
		plugins
	);
	const [canScrollPrev, setCanScrollPrev] = React.useState(false);
	const [canScrollNext, setCanScrollNext] = React.useState(false);

	const onSelect = React.useCallback((api: CarouselApi) => {
		if (!api) return;
		setCanScrollPrev(api.canScrollPrev());
		setCanScrollNext(api.canScrollNext());
	}, []);

	const scrollPrev = React.useCallback(() => {
		api?.scrollPrev();
	}, [api]);

	const scrollNext = React.useCallback(() => {
		api?.scrollNext();
	}, [api]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			// Captured from the root, so this sees arrow keys aimed at anything a
			// consumer put inside a slide. Claim them only for the carousel's own
			// parts — an allowlist, because the set of widgets that owns Left/Right
			// is open-ended (text fields, selects and sliders, but also radio
			// groups, tabs, comboboxes, menus, grids and trees), and preventDefault
			// below would scroll the carousel instead of letting the focused widget
			// move its caret or change its selection. Anything wanting in opts in
			// with a `data-slot="carousel-*"` attribute.
			const target = event.target as HTMLElement | null;
			if (
				target !== event.currentTarget &&
				!target?.dataset.slot?.startsWith('carousel')
			) {
				return;
			}
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				scrollPrev();
			} else if (event.key === 'ArrowRight') {
				event.preventDefault();
				scrollNext();
			}
		},
		[scrollPrev, scrollNext]
	);

	React.useEffect(() => {
		if (!api || !setApi) return;
		setApi(api);
	}, [api, setApi]);

	React.useEffect(() => {
		if (!api) return;
		onSelect(api);
		api.on('reInit', onSelect);
		api.on('select', onSelect);

		return () => {
			api?.off('reInit', onSelect);
			api?.off('select', onSelect);
		};
	}, [api, onSelect]);

	return (
		<CarouselContext.Provider
			value={{
				carouselRef,
				api: api,
				opts,
				orientation,
				scrollPrev,
				scrollNext,
				canScrollPrev,
				canScrollNext,
			}}
		>
			<div
				onKeyDownCapture={handleKeyDown}
				className={cn('relative', className)}
				role="region"
				aria-roledescription="carousel"
				data-slot="carousel"
				{...props}
			>
				{children}
			</div>
		</CarouselContext.Provider>
	);
}

function CarouselContent({ className, ...props }: React.ComponentProps<'div'>) {
	const { carouselRef, orientation } = useCarousel();

	return (
		<div
			ref={carouselRef}
			className="overflow-hidden"
			data-slot="carousel-content"
		>
			<div
				className={cn(
					'flex',
					orientation === 'horizontal' ? '-ml-4' : '-mt-4 flex-col',
					className
				)}
				{...props}
			/>
		</div>
	);
}

function CarouselItem({ className, ...props }: React.ComponentProps<'div'>) {
	const { orientation } = useCarousel();

	return (
		<div
			role="group"
			aria-roledescription="slide"
			data-slot="carousel-item"
			className={cn(
				'min-w-0 shrink-0 grow-0 basis-full',
				orientation === 'horizontal' ? 'pl-4' : 'pt-4',
				className
			)}
			{...props}
		/>
	);
}

function CarouselPrevious({
	className,
	variant = 'outline',
	size = 'icon-sm',
	label = 'Previous slide',
	...props
}: React.ComponentProps<typeof Button> & {
	/** Screen-reader name. Pass a translated string on localized pages. */
	label?: string;
}) {
	const { orientation, scrollPrev, canScrollPrev } = useCarousel();

	return (
		<Button
			data-slot="carousel-previous"
			variant={variant}
			size={size}
			className={cn(
				'absolute touch-manipulation rounded-full',
				// aria-disabled, not disabled — see the note on CarouselNext.
				'aria-disabled:pointer-events-none aria-disabled:opacity-50',
				orientation === 'horizontal'
					? 'inset-y-0 -left-12 my-auto'
					: '-top-12 left-1/2 -translate-x-1/2 rotate-90',
				className
			)}
			aria-disabled={!canScrollPrev}
			onClick={scrollPrev}
			{...props}
		>
			<ChevronLeftIcon className="cn-rtl-flip" />
			<span className="sr-only">{label}</span>
		</Button>
	);
}

function CarouselNext({
	className,
	variant = 'outline',
	size = 'icon-sm',
	label = 'Next slide',
	...props
}: React.ComponentProps<typeof Button> & {
	/** Screen-reader name. Pass a translated string on localized pages. */
	label?: string;
}) {
	const { orientation, scrollNext, canScrollNext } = useCarousel();

	return (
		<Button
			data-slot="carousel-next"
			variant={variant}
			size={size}
			className={cn(
				'absolute touch-manipulation rounded-full',
				// aria-disabled, not `disabled`: browsers move focus to <body> when the
				// focused element becomes disabled, so with loop:false a keyboard user
				// pressing Next onto the last slide was ejected from the carousel — and
				// past the root, whose onKeyDownCapture owns the arrow keys, leaving no
				// way back in. This keeps the button focusable and looking disabled;
				// pointer-events-none stops the click, and embla's scrollNext is already
				// a no-op at the end, so nothing needs a guard.
				'aria-disabled:pointer-events-none aria-disabled:opacity-50',
				orientation === 'horizontal'
					? 'inset-y-0 -right-12 my-auto'
					: '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
				className
			)}
			aria-disabled={!canScrollNext}
			onClick={scrollNext}
			{...props}
		>
			<ChevronRightIcon className="cn-rtl-flip" />
			<span className="sr-only">{label}</span>
		</Button>
	);
}

export {
	type CarouselApi,
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselPrevious,
	CarouselNext,
	useCarousel,
};
