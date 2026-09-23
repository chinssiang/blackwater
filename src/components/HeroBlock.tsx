import { stegaClean } from '@sanity/client/stega';
import { revealStagger } from '@/lib/animate';
import { type HeroBlockData, heroBlockIsRenderable } from '@/lib/hero-block';
import type { SanityColor } from '@/lib/image-utils';
import {
	type TextAlignClass,
	resolveSectionAppearance,
} from '@/lib/section-appearance';
import { cn, hasArrayValue } from '@/lib/utils';
import CustomLink from '@/components/CustomLink';
import CustomPortableText from '@/components/CustomPortableText';
import { HeroUnderlay } from '@/components/HeroUnderlay';
// The lazy boundary for the canvas; the note in that file says why it exists.
import { HeroWave } from '@/components/HeroWaveLazy';
import ImageBlock from '@/components/ImageBlock';
import SectionShell from '@/components/SectionShell';
import { WeatherWidget } from '@/components/WeatherWidgetLazy';
import { buttonVariants } from '@/components/ui/Button';

const WAVE_PAPER: SanityColor = {
	hex: '#0a0a0a',
	rgb: { r: 10, g: 10, b: 10, a: 1 },
};

// The copy column's width when Max Width is 'Full', which every hero carries
// from the shared object's `initialValue`. Mapping 'Full' to the full content
// box would restyle all of them at once, so it keeps the hero's own reading
// measure instead -- deliberately off the MAX_WIDTH_PX ladder, since this is a
// default, not a rung. hero-block.ts's field description tells the editor.
const DEFAULT_COPY_MEASURE = 'max-w-2xl';

// Which auto margin puts a capped copy column where its Text Alignment says it
// belongs. Total over TextAlignClass, so adding a fifth alignment to
// section-appearance.ts fails the build here instead of silently centring.
//
// Hero-only: every other module is centred by the shell's own `mx-auto` on the
// <section>, because there the section IS the capped box. Only the hero has a
// narrow column inside a full-width one.
const COPY_MARGIN_CLASSES: Record<TextAlignClass, string> = {
	'text-left': 'mr-auto',
	'text-justify': 'mr-auto',
	'text-center': 'mx-auto',
	'text-right': 'ml-auto',
};

type HeroBlockProps = {
	data: HeroBlockData;
	/**
	 * `h1` when this hero is the page's own title — the homepage, where nothing
	 * above it claims one. PageGeneral already renders an h1 for the page title,
	 * so a hero there is a section heading and stays h2 (the default).
	 */
	headingLevel?: 'h1' | 'h2';
	/**
	 * Whether this hero carries the page's single weather widget — the page
	 * component picks the first heroBlock in the array. Nothing caps how many
	 * heroBlocks a builder may hold, so rendering one per hero would put two on a
	 * two-hero page, each polling `/api/weather` on its own schedule and showing
	 * its own timestamp. See the note on `ownsWeatherWidget` in PageModules for
	 * why this is ownership rather than position.
	 */
	ownsWeatherWidget?: boolean;
	/**
	 * Whether this hero is the page's FIRST module, i.e. the thing a visitor sees
	 * on the first paint. Decided by position in the page component, like
	 * `headingLevel` and unlike `ownsWeatherWidget` — see the note on the heading
	 * below for why the heading level cannot stand in for it.
	 */
	isPageOpener?: boolean;
	className?: string;
};

export default function HeroBlock({
	data,
	headingLevel = 'h2',
	ownsWeatherWidget = false,
	isPageOpener = false,
	className,
}: HeroBlockProps) {
	const {
		eyebrow,
		heading,
		paragraph,
		backgroundImage,
		waveBackground,
		callToAction,
		sectionAppearance,
	} = data || {};

	const Heading = headingLevel;
	// `href` arrives as `unknown`: resolvedHrefGroq is a select() typegen cannot
	// narrow. A CTA whose link resolves to nothing renders as no CTA at all.
	const ctaHref =
		typeof callToAction?.link?.href === 'string'
			? callToAction.link.href
			: null;
	const ctaLabel = callToAction?.label;

	// Trimmed and stega-cleaned before anything decides whether there is a
	// heading. `src/lib/page-modules.ts` used to do this upstream and was deleted
	// with the old hero fallback; nothing replaced it, so raw truthiness let a
	// heading an editor had blanked to spaces both defeat the emptiness bail
	// below AND render `<h1>   </h1>` -- an a11y failure a crawler reads rather
	// than falling through to the next heading. Draft mode also appends invisible
	// stega characters, which would make any heading look non-empty. A predicate,
	// not the rendered value: the raw `heading` is what gets rendered, so visual
	// editing keeps its stega metadata.
	const hasHeading = !!stegaClean(heading)?.trim();

	const hasParagraph: boolean = hasArrayValue(paragraph);

	const appearance = waveBackground
		? { ...sectionAppearance, backgroundColor: WAVE_PAPER }
		: sectionAppearance;

	// Resolved here, not left to the shell, because this module splits the
	// appearance across two elements: the SECTION takes everything but the width,
	// and the COPY COLUMN takes the width. The background image and <HeroWave>
	// are `absolute inset-0` children of the section, so a cap on the section is
	// a cap on the ARTWORK. DESIGN.md (section Sections) has the full rule and
	// why no other module needs it.
	const { alignClass, maxWidthClass, isFullWidth } =
		resolveSectionAppearance(appearance);

	// `headingLevel === 'h1'`, NOT `isPageOpener`: this needs "first thing in
	// <main>", and only PageHome's slot 0 is that -- PageGeneral renders its own
	// <h1> above its modules yet still passes `isPageOpener` to slot 0, and the
	// CSS hooks match `body:has([data-hero-underlay])` anywhere in the body, so
	// a hero there would pull the page title up under the header. See the note on
	// the heading below for the mirror-image case, where position is what counts.
	const underlapsHeader = !!waveBackground && headingLevel === 'h1';

	// The entrance, for all four of eyebrow/heading/paragraph/CTA at once. A hero
	// that OPENS the page has none: `reveal` holds an element at `opacity: 0`
	// through the whole delay window, and the heading is the LCP element, which
	// Chrome will not measure while it is fully transparent (the long note at the
	// heading has the rest, including why this keys on position and not on
	// `headingLevel`).
	//
	// ALL FOUR, not just the heading. `revealStagger` is one cadence across
	// indices 0..3, so exempting the heading alone left a hole in the middle of
	// it -- eyebrow fading in at 0s, the heading already solid, paragraph
	// arriving 0.12s later. A cascade with its second beat missing reads as a
	// glitch, and dropping the whole thing is also strictly better for the LCP,
	// since a fading eyebrow above the heading is itself paint the measurement
	// waits on.
	const entrance = (index: number) =>
		isPageOpener
			? { className: undefined, style: undefined }
			: { className: 'reveal', style: revealStagger(index) };

	// Same bail as the other modules: an empty hero would still reserve a full
	// viewport of blank page, which is worse than not rendering.
	if (!heroBlockIsRenderable(data)) {
		return null;
	}

	return (
		<SectionShell
			// Explicit 'none' rather than dropping the key, so the resolver takes
			// its documented `none` branch rather than its unknown-key fallback --
			// the two agree today, and spelling the intent means they need not keep
			// agreeing. `appearance` above keeps the AUTHORED width, which is what
			// the copy column below is capped by.
			appearance={{ ...appearance, maxWidth: 'none' }}
			className={cn(
				'relative isolate flex flex-col justify-center overflow-hidden',
				// The underlap arm opens at 90% of the SMALL viewport, not `vh`: the
				// header floats over this hero so no header height is involved, but
				// `vh` is the LARGE viewport, which overflows the visible area while
				// mobile browser chrome is expanded. The toolbar strip is subtracted
				// below `lg` only, mirroring the two arms of `--h-main` -- `ToolBar`
				// is `fixed bottom-0 lg:hidden`, so it covers that strip on mobile
				// and does not exist above it.
				underlapsHeader
					? 'min-h-[calc(90svh-var(--height-g-toolbar))] lg:min-h-[90svh]'
					: 'min-h-main',
				className
			)}
		>
			{waveBackground ? (
				underlapsHeader ? (
					<HeroUnderlay>
						<HeroWave />
					</HeroUnderlay>
				) : (
					<div aria-hidden className="absolute inset-0 -z-10">
						<HeroWave />
					</div>
				)
			) : backgroundImage?.image ? (
				<div aria-hidden className="absolute inset-0 -z-10">
					<ImageBlock
						imageObj={backgroundImage}
						alt=""
						fill="cover"
						sizes="100vw"
						// No `priority`, for the reason ProductsBlock spells out: exactly
						// one image per page is the LCP candidate and a module cannot know
						// whether the page above it already claimed that.
					/>
				</div>
			) : null}

			{/* The copy column -- the only thing Max Width caps here. */}
			<div
				className={cn(
					// Load-bearing, not tidying. The section is `flex flex-col`, so this
					// is a flex item on the column's CROSS axis, and an auto cross-axis
					// margin disables `align-self: stretch` (Flexbox 9.4) -- leaving the
					// box shrink-to-fit, where a max-width binds only once the content
					// already exceeds it. Measured on a heading-only hero: 168px without
					// this, the authored 768px with it, so m/l/xl would have stayed inert
					// even after the cap moved here.
					'w-full',
					COPY_MARGIN_CLASSES[alignClass],
					// A ternary rather than `cn(DEFAULT_COPY_MEASURE, maxWidthClass)`,
					// which resolves correctly only through tailwind-merge's group
					// classification and leaves a stray class behind.
					isFullWidth ? DEFAULT_COPY_MEASURE : maxWidthClass,
					underlapsHeader && 'mt-header-space-0'
				)}
			>
				{eyebrow && (
					<p
						className={cn('t-spec mb-3 uppercase', entrance(0).className)}
						style={entrance(0).style}
					>
						{eyebrow}
					</p>
				)}

				{hasHeading && (
					// This is the element `entrance()` above exists for: the largest
					// thing in the first viewport, so the LCP candidate, and `reveal`
					// starts it at `opacity: 0` through @starting-style, which Chrome
					// will not accept as a candidate -- see the note in layout/index.tsx,
					// which exempts the first paint from `animate-page-in` for the same
					// reason and is the other half of this fix.
					//
					// Gated on `isPageOpener` (position), NOT on `headingLevel`. Those
					// look interchangeable and are not: PageGeneral renders the page
					// title as its own <h1> and passes no level, so every one of its
					// modules sits at the 'h2' default -- while this component renders
					// the heading at `t-h-1` whatever the tag, i.e. far larger than
					// PageGeneral's `t-b-1` title. Keying on the tag therefore left a
					// heroBlock in slot 0 of any /[slug] page as an LCP element that
					// still faded in, which is the exact condition this exists to
					// remove.
					//
					// Do NOT substitute a `transition-*`/`duration-*` utility here to
					// "keep some motion": `reveal` sets the transition shorthand from
					// @layer utilities, and a Tailwind transition utility at equal
					// specificity rewrites transition-property and kills the entrance
					// silently (CLAUDE.md, page architecture).
					<Heading
						className={cn(
							't-h-1 text-balance uppercase',
							entrance(1).className
						)}
						style={entrance(1).style}
					>
						{heading}
					</Heading>
				)}

				{hasParagraph && (
					<div
						className={cn('wysiwyg mt-4', entrance(2).className)}
						style={entrance(2).style}
					>
						<CustomPortableText blocks={paragraph} />
					</div>
				)}

				{ctaHref && ctaLabel && (
					<div
						className={cn('mt-6', entrance(3).className)}
						style={entrance(3).style}
					>
						<CustomLink
							link={{
								href: ctaHref,
								isNewTab: callToAction?.link?.isNewTab ?? false,
							}}
							className={buttonVariants({ size: 'lg' })}
						>
							{ctaLabel}
						</CustomLink>
					</div>
				)}
			</div>
			{ownsWeatherWidget && <WeatherWidget />}
		</SectionShell>
	);
}
