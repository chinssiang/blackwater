import { stegaClean } from '@sanity/client/stega';
import CustomPortableText from '@/components/CustomPortableText';
import CustomLink from '@/components/CustomLink';
import ImageBlock from '@/components/ImageBlock';
// The lazy boundary for the canvas; the note in that file says why it exists.
import { HeroWave } from '@/components/HeroWaveLazy';
import { HeroUnderlay } from '@/components/HeroUnderlay';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { buttonVariants } from '@/components/ui/Button';
import { revealStagger } from '@/lib/animate';
import type { SanityColor } from '@/lib/image-utils';
import { resolveSectionAppearance } from '@/lib/section-appearance';
import { cn, hasArrayValue } from '@/lib/utils';

// The page opener: eyebrow, heading, paragraph and an optional call to action
// over an optional background image.
//
// Entrance is the `reveal` utility, not Motion. Both make invisible the default
// state and need something to execute to undo it, so a hero the browser never
// paints -- or one whose JS never hydrates -- would strand the page's own
// heading at opacity: 0. `reveal` puts the hidden value in @starting-style
// instead, so it is only ever a transition start point. The Motion mount
// animation this replaced sat on exactly that heading, which is how the trap was
// found -- don't reintroduce one here.

// The wave's trough colour (HeroWave.tsx BASE, about #0a0a0a). It is the
// section's paper as far as ink is concerned: the canvas paints opaquely over
// whatever background an editor authored, so the resolver has to see THIS
// colour, or a light authored paper would earn dark ink that then sits on the
// dark water. The bottom mask dissolves into this paper too.
const WAVE_PAPER: SanityColor = {
	hex: '#0a0a0a',
	rgb: { r: 10, g: 10, b: 10, a: 1 },
};

type HeroBlockProps = {
	data: {
		eyebrow?: string | null;
		heading?: string | null;
		paragraph?: any;
		backgroundImage?: any;
		// Resolved to a boolean in GROQ (heroBlockField), never the raw string.
		waveBackground?: boolean | null;
		callToAction?: {
			label?: string | null;
			link?: { href?: unknown; isNewTab?: boolean | null } | null;
		} | null;
		sectionAppearance?: SectionAppearance;
	};
	/**
	 * `h1` when this hero is the page's own title — the homepage, where nothing
	 * above it claims one. PageGeneral already renders an h1 for the page title,
	 * so a hero there is a section heading and stays h2 (the default).
	 */
	headingLevel?: 'h1' | 'h2';
	className?: string;
};

export default function HeroBlock({
	data,
	headingLevel = 'h2',
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

	// `hasArrayValue`, not raw truthiness: Sanity leaves `paragraph: []` behind
	// when an editor deletes the last portable-text block, and `[]` is truthy --
	// so `!paragraph` could never fire the bail below, and the render gate emitted
	// an empty `.wysiwyg` box. Hoisted to a boolean rather than called inline at
	// both sites because `paragraph` is `any`, and the type guard would narrow it
	// to `unknown[]` where CustomPortableText wants PortableTextBlock[] (the
	// explicit `: boolean` is what stops that aliased narrowing).
	const hasParagraph: boolean = hasArrayValue(paragraph);

	// The wave hero that opens the page runs under the site header, which then
	// starts transparent; the contract is the `[data-site-header]` rules in
	// globals.css. `headingLevel === 'h1'` is the signal that this hero is the
	// first thing on the page (PageHome passes it for slot 0 only; PageGeneral
	// renders its own title above the modules). Wave only: an image hero's
	// colours are the editor's, so near-white header ink has no guaranteed
	// contrast over it. Full width only, too: an authored max width would leave
	// a narrow column under a full-width transparent header.
	const appearance = waveBackground
		? { ...sectionAppearance, backgroundColor: WAVE_PAPER }
		: sectionAppearance;
	const underlapsHeader =
		!!waveBackground &&
		headingLevel === 'h1' &&
		resolveSectionAppearance(appearance).maxWidthClass === 'w-full';

	// Same bail as the other modules: an empty hero would still reserve a full
	// viewport of blank page, which is worse than not rendering.
	if (
		!eyebrow &&
		!hasHeading &&
		!hasParagraph &&
		!backgroundImage?.image &&
		!waveBackground &&
		!(ctaHref && ctaLabel)
	) {
		return null;
	}

	return (
		<SectionShell
			appearance={appearance}
			className={cn(
				'relative isolate flex flex-col justify-center overflow-hidden',
				// Pulled up by the sticky stack's height with that height added back,
				// so the box starts at the top of the document and ends where it did.
				// The header is sticky and in flow (nothing offsets <main>), which is
				// why the hero moves rather than the header. Header plus announcement,
				// the same sum every other header offset in globals.css composes.
				underlapsHeader
					? '-mt-[calc(var(--height-header)+var(--height-announcement))] min-h-[calc(var(--height-main)+var(--height-header)+var(--height-announcement))]'
					: 'min-h-main',
				className
			)}
		>
			{waveBackground ? (
				// Replaces the image rather than layering over it: the shader writes
				// alpha 255 to every pixel, so an image beneath could never show, and
				// the schema hides the image field while the wave is selected. Same
				// -z-10/isolate arrangement as the image branch. Under the header the
				// wrapper is HeroUnderlay, which marks itself and drives the header's
				// progress for as long as it is mounted.
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
				// -z-10 with `isolate` above: the image sits behind the copy without
				// escaping into the stacking context of whatever follows the section.
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

			{/* Measure cap. The copy is a column, not a banner: as direct flex
			    children of the section these stretch to `maxWidthClass`, which
			    defaults to `w-full` inside a `p-x-max` inset -- up to
			    --container-max (2000px), roughly 200 characters a line for the
			    paragraph. The background image stays outside this wrapper so it
			    remains full-bleed. An authored `sectionAppearance.maxWidth` still
			    applies on the section, above this. */}
			<div
				// Under the header the copy gets the sticky stack's height as a top
				// margin: inside justify-center the margin is part of the item's outer
				// box, so the copy stays centred in the region below the header instead
				// of drifting up under the menu.
				className={cn(
					'max-w-2xl mx-auto',
					underlapsHeader && 'mt-header-space-0'
				)}
			>
				{eyebrow && (
					<p className="t-spec reveal mb-3 uppercase" style={revealStagger(0)}>
						{eyebrow}
					</p>
				)}

				{hasHeading && (
					<Heading
						className="t-h-1 reveal text-balance uppercase"
						style={revealStagger(1)}
					>
						{heading}
					</Heading>
				)}

				{hasParagraph && (
					<div className="wysiwyg reveal mt-4" style={revealStagger(2)}>
						<CustomPortableText blocks={paragraph} />
					</div>
				)}

				{ctaHref && ctaLabel && (
					<div className="reveal mt-6" style={revealStagger(3)}>
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
		</SectionShell>
	);
}
