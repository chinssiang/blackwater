'use client';

import { type CSSProperties, JSX } from 'react';
import {
	SANITY_IMAGE_QUALITY,
	buildSanityImageUrl,
	hotspotObjectPosition,
	resolveRenderedRatio,
} from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import Caption from '@/components/Caption';
import SanityImage from '@/components/SanityImage';
import type { SanityImageData } from '@/components/SanityImage';

export interface ImageBlockObj {
	image?: SanityImageData | null;
	imageMobile?: SanityImageData | null;
	customRatio?: number | null;
	customRatioMobile?: number | null;
	caption?: string | null;
}

interface ImageBlockProps {
	imageObj?: ImageBlockObj | null;
	alt?: string;
	className?: string;
	fill?: 'cover' | 'contain';
	quality?: number;
	sizes?: string;
	priority?: boolean;
}

// Where the mobile image takes over from the desktop one, in the two <source>
// media queries below. A constant rather than a prop: the hotspot override has
// to name the same width as a literal class, and a prop could only make the two
// disagree (no caller ever passed one).
const MOBILE_MAX_WIDTH = 768;

// Next's default deviceSizes + imageSizes, which next.config.mjs overrides
// neither of. Restated here because a <source srcSet> is a plain string: it
// cannot go through next/image's `loader`, so the candidate widths have to be
// spelled out. Keep in step if the image config ever gains its own lists.
const CANDIDATE_WIDTHS = [
	32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
];

/**
 * A responsive srcSet for a <source>, built through the same Sanity CDN builder
 * the inner <img> uses.
 *
 * Capped at the asset's own width -- and the cap is the last entry, not a filter,
 * so the widest candidate is the widest that actually exists. That is stricter
 * than the inner <img> manages: next/image builds its descriptors from the global
 * width lists with no per-image way to trim them, so it will advertise `3840w` for
 * a 1080px asset. Here nothing over-promises.
 *
 * It does NOT also narrow the list by the smallest vw share in `sizes`, which is
 * the other half of what next/image's own getWidths does. That rule is a regex
 * over `sizes` and copying it means copying its blind spot -- a `calc(100vw - 2rem)`
 * matches nothing and silently falls back to every width -- to save ~1KB of
 * pre-gzip markup on a branch that currently renders on no page in the site. The
 * native-width cap already does the part that matters.
 */
function buildSrcSet(
	image: SanityImageData,
	nativeWidth: number | undefined,
	quality: number,
	cropRatio: number | undefined
): string {
	const widths = nativeWidth
		? [...CANDIDATE_WIDTHS.filter((w) => w < nativeWidth), nativeWidth]
		: CANDIDATE_WIDTHS;

	return widths
		.map(
			(w) =>
				`${buildSanityImageUrl(image, { width: w, quality, cropRatio })} ${w}w`
		)
		.join(', ');
}

function ImageBlock({
	imageObj,
	alt,
	className,
	fill,
	quality = SANITY_IMAGE_QUALITY,
	sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
	priority = false,
}: ImageBlockProps): JSX.Element | null {
	if (!imageObj) return null;

	const fillClass =
		fill === 'cover'
			? 'img-object-cover'
			: fill === 'contain'
				? 'img-object-contain'
				: null;
	const {
		image,
		imageMobile: responsiveImage,
		caption,
		customRatio,
		customRatioMobile,
	} = imageObj;

	if (!image) return null;

	// No `fill` prop: SanityImage derives it from the same metadata and the same
	// customRatio, so passing it here only gave the two a way to disagree.
	const imageEl = (
		<SanityImage
			image={image}
			alt={alt}
			customRatio={customRatio}
			quality={quality}
			sizes={sizes}
			priority={priority}
			className={className}
		/>
	);

	let content: JSX.Element | null;

	// `priority` and the <picture> branch are mutually exclusive. A matching
	// <source> always wins over the inner <img> (the two media queries below
	// cover every viewport), while next/image still emits a
	// <link rel="preload" as="image"> for its OWN srcSet — so a prioritized image
	// would preload one resource and then load another. For the one prioritized
	// image per page, take the plain next/image path and drop the art direction.
	//
	// What the <source>s carry is the part that changed. They used to hold a
	// single raw, full-resolution cdn.sanity.io URL, so the bytes that actually
	// loaded in this branch were an unoptimized original that ignored `sizes`
	// entirely — the optimization bug the `!priority` guard was never about. They
	// are real srcSets now, built through the same CDN builder as the inner
	// <img>, so both branches are optimized and only the preload argument above
	// still justifies the guard.
	if (responsiveImage && !priority) {
		// Only the <source> elements need these: they carry the intrinsic ratio
		// that the inner <img> gets from SanityImage. Each ratio is passed to
		// buildSrcSet as well as used for the attribute, so the bytes come back
		// cropped to the box the <source> advertises -- see buildSanityImageUrl.
		const { dimensions } = image.metadata || {};
		const width = dimensions?.width ?? undefined;
		const ratio = resolveRenderedRatio(
			dimensions?.aspectRatio,
			image.crop,
			customRatio
		);
		const height = width && ratio ? Math.round(width / ratio) : undefined;

		const { dimensions: rDimensions } = responsiveImage.metadata || {};
		const rWidth = rDimensions?.width ?? undefined;
		const rRatio = resolveRenderedRatio(
			rDimensions?.aspectRatio,
			responsiveImage.crop,
			customRatioMobile
		);
		const rHeight = rWidth && rRatio ? Math.round(rWidth / rRatio) : undefined;

		// The <img> carries the desktop image's hotspot (SanityImage sets it); the
		// mobile <source> is a different bitmap with its own. One element takes one
		// position, so below the breakpoint the <picture> sets
		// `--hotspot-override`, which SanityImage's inline position defers to, and
		// the <img> reads it directly for the case where the desktop image has no
		// hotspot and so no inline position at all. Always, not only when the
		// mobile image has a hotspot of its own, or it would inherit the desktop
		// one. The query is a literal because Tailwind only emits classes it finds
		// verbatim; image-utils.test.ts holds it to MOBILE_MAX_WIDTH. Not on a
		// contained image, which globals.css keeps centred.
		const mobilePosition =
			hotspotObjectPosition(
				rDimensions?.aspectRatio,
				responsiveImage.crop,
				responsiveImage.hotspot,
				customRatioMobile
			) ?? '50% 50%';
		const positionsMobile = fill !== 'contain';

		content = (
			<picture
				className={cn(
					fillClass,
					positionsMobile &&
						'[@media(max-width:768px)]:[--hotspot-override:var(--hotspot-mobile)] [&_img]:[@media(max-width:768px)]:object-(--hotspot-override)',
					className
				)}
				style={
					positionsMobile
						? ({ '--hotspot-mobile': mobilePosition } as CSSProperties)
						: undefined
				}
			>
				<source
					media={`(min-width: ${MOBILE_MAX_WIDTH + 1}px)`}
					srcSet={buildSrcSet(image, width, quality, customRatio || undefined)}
					sizes={sizes}
					width={width}
					height={height}
				/>
				<source
					media={`(max-width: ${MOBILE_MAX_WIDTH}px)`}
					srcSet={buildSrcSet(
						responsiveImage,
						rWidth,
						quality,
						customRatioMobile || undefined
					)}
					sizes={sizes}
					width={rWidth}
					height={rHeight}
				/>
				{imageEl}
			</picture>
		);
	} else if (fillClass) {
		content = <span className={cn(fillClass, className)}>{imageEl}</span>;
	} else {
		content = imageEl;
	}

	if (!caption) return content;

	return (
		<div className={cn('relative', className)}>
			{content}
			<Caption className="absolute bottom-2 left-2" caption={caption} />
		</div>
	);
}

export default ImageBlock;
