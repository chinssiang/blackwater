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

	const hasParagraph: boolean = hasArrayValue(paragraph);

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
				// The header height is ADDED back on the underlap arm: `--height-main`
				// subtracts it, and a hero the header floats over gets that space back.
				underlapsHeader
					? 'min-h-[calc(var(--height-main)+var(--height-header)+var(--height-announcement))]'
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

			<div
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
