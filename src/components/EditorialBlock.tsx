import type { ReactNode } from 'react';
import type {
	ArbitraryTypedObject,
	PortableTextBlock,
} from '@portabletext/types';
import { stegaClean } from '@sanity/client/stega';
import { revealEntrance } from '@/lib/animate';
import { resolveCopyColumnClass } from '@/lib/section-appearance';
import { SECTION_CONTENT_INSET, cn, hasArrayValue } from '@/lib/utils';
import { toVimeoEmbedUrl } from '@/lib/vimeo';
import CustomLink from '@/components/CustomLink';
import CustomPortableText from '@/components/CustomPortableText';
import EditorialVideoDialog, {
	type EditorialVideo,
} from '@/components/EditorialVideoDialog';
import ImageBlock, { type ImageBlockObj } from '@/components/ImageBlock';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';
import { buttonVariants } from '@/components/ui/Button';

// The copy column's width when Max Width is 'Full' -- a reading measure rather
// than the whole half (or the whole section), like HeroBlock's own default.
const DEFAULT_COPY_MEASURE = 'max-w-xl';

type EditorialBlockProps = {
	data: {
		// Both resolved to booleans in GROQ (editorialBlockField), never the raw
		// radio strings.
		backgroundLayout?: boolean | null;
		imageRight?: boolean | null;
		eyebrow?: string | null;
		heading?: string | null;
		paragraph?: (PortableTextBlock | ArbitraryTypedObject)[] | null;
		image?: ImageBlockObj | null;
		callToAction?: {
			label?: string | null;
			// Exactly one target family is projected, by the CTA's `action`.
			link?: { href?: unknown; isNewTab?: boolean | null } | null;
			vimeoUrl?: string | null;
			videoFile?: { url?: string | null; mimeType?: string | null } | null;
		} | null;
		sectionAppearance?: SectionAppearance;
	};
	headingLevel?: 'h1' | 'h2';
	/** The page's first module -- see HeroBlock, which reads it the same way. */
	isPageOpener?: boolean;
};

export default function EditorialBlock({
	data,
	headingLevel = 'h2',
	isPageOpener = false,
}: EditorialBlockProps) {
	const {
		backgroundLayout,
		imageRight,
		eyebrow,
		heading,
		paragraph,
		image,
		callToAction,
		sectionAppearance,
	} = data || {};

	const Heading = headingLevel;
	// Cleaned and trimmed for the reason HeroBlock gives: a blanked or
	// stega-encoded heading must not count as one.
	const hasHeading = !!stegaClean(heading)?.trim();
	const hasParagraph: boolean = hasArrayValue(paragraph);
	const hasImage = !!image?.image;

	// Like the hero, this splits the appearance: the SECTION spans the full
	// width (so the image can reach the window edge), and the Max Width caps the
	// COPY COLUMN alone.
	const copyColumnClass = resolveCopyColumnClass(
		sectionAppearance,
		DEFAULT_COPY_MEASURE
	);

	// One beat each for eyebrow, heading, paragraph and CTA -- or no entrance at
	// all on the page opener (see revealEntrance).
	const eyebrowIn = revealEntrance(0, isPageOpener);
	const headingIn = revealEntrance(1, isPageOpener);
	const paragraphIn = revealEntrance(2, isPageOpener);
	const ctaIn = revealEntrance(3, isPageOpener);

	const ctaLabel = callToAction?.label;
	// `href` arrives as `unknown`: resolvedHrefGroq is a select() typegen cannot
	// narrow.
	const ctaHref =
		typeof callToAction?.link?.href === 'string'
			? callToAction.link.href
			: null;
	const vimeoEmbedUrl = toVimeoEmbedUrl(callToAction?.vimeoUrl);
	const fileUrl = callToAction?.videoFile?.url;
	const video: EditorialVideo | null = vimeoEmbedUrl
		? { vimeoEmbedUrl }
		: fileUrl
			? { fileUrl, mimeType: callToAction?.videoFile?.mimeType }
			: null;

	let cta: ReactNode = null;
	if (ctaLabel && video) {
		cta = <EditorialVideoDialog label={ctaLabel} video={video} />;
	} else if (ctaLabel && ctaHref) {
		cta = (
			<CustomLink
				link={{
					href: ctaHref,
					isNewTab: callToAction?.link?.isNewTab ?? false,
				}}
				className={buttonVariants({ size: 'lg' })}
			>
				{ctaLabel}
			</CustomLink>
		);
	}

	if (!(hasImage || eyebrow || hasHeading || hasParagraph || cta)) {
		return null;
	}

	const copy = (
		<div className={copyColumnClass}>
			{eyebrow && (
				<p
					className={cn('t-spec mb-3 uppercase', eyebrowIn.className)}
					style={eyebrowIn.style}
				>
					{eyebrow}
				</p>
			)}
			{hasHeading && (
				<Heading
					className={cn('t-h-1 text-balance uppercase', headingIn.className)}
					style={headingIn.style}
				>
					{heading}
				</Heading>
			)}
			{hasParagraph && (
				<div
					className={cn('wysiwyg mt-4', paragraphIn.className)}
					style={paragraphIn.style}
				>
					<CustomPortableText blocks={paragraph} />
				</div>
			)}
			{cta && (
				<div className={cn('mt-6', ctaIn.className)} style={ctaIn.style}>
					{cta}
				</div>
			)}
		</div>
	);

	// `maxWidth: 'none'` in both layouts: the authored width is already spent on
	// the copy column above.
	const shellAppearance = { ...sectionAppearance, maxWidth: 'none' };

	if (backgroundLayout) {
		return (
			<SectionShell
				appearance={shellAppearance}
				className="relative isolate flex min-h-[70svh] flex-col justify-center overflow-hidden"
			>
				{hasImage && (
					<div aria-hidden className="absolute inset-0 -z-10">
						<ImageBlock
							imageObj={image}
							alt=""
							fill="cover"
							sizes="100vw"
							// No `priority`: a module cannot know whether the page above it
							// already claimed the one LCP image.
						/>
						{/* The contrast guard nothing else gives text over a photo.
						    `--background` is the section's paper token, so an authored
						    Background Color tints the scrim too. */}
						<div className="bg-background/50 absolute inset-0" />
					</div>
				)}
				{copy}
			</SectionShell>
		);
	}

	return (
		<SectionShell
			appearance={shellAppearance}
			// `bleed` drops the shell's own inset so the image can run to the
			// window edge; the text cell below puts it back.
			bleed
			className={cn(
				'grid gap-y-8',
				hasImage && 'lg:grid-cols-2 lg:items-center'
			)}
		>
			{hasImage && (
				<div className={cn(imageRight && 'lg:order-last')}>
					<ImageBlock
						imageObj={image}
						sizes="(min-width: 64rem) 50vw, 100vw"
						// The height cap. A half-width image at its own proportions runs
						// ~700px tall for a square and ~1000px for a 5:7 crop at 1440px,
						// so past this height it is cover-cropped around its hotspot
						// instead: wide images keep their shape, tall ones stop growing
						// the section. On the <img> rather than a box around it, so an
						// image shorter than the cap keeps its natural height.
						className="max-h-[min(60svh,36rem)] w-full object-cover"
					/>
				</div>
			)}
			<div
				className={cn(
					// The outer edge keeps the section inset, so the text lines up
					// with every other module's content edge; the edge facing the
					// image gets a fixed gutter instead.
					SECTION_CONTENT_INSET,
					hasImage && (imageRight ? 'lg:pr-12' : 'lg:pl-12')
				)}
			>
				{copy}
			</div>
		</SectionShell>
	);
}
