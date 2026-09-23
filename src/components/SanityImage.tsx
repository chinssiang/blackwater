'use client';

import { JSX, useState } from 'react';
import Image, { type ImageLoader } from 'next/image';
import {
	SANITY_IMAGE_QUALITY,
	buildSanityImageUrl,
	resolveRenderedRatio,
} from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import type {
	SanityImageAssetReference,
	SanityImageCrop,
	SanityImageHotspot,
} from 'sanity.types';

export interface SanityImageData {
	asset?: SanityImageAssetReference | null;
	crop?: SanityImageCrop | null;
	hotspot?: SanityImageHotspot | null;
	altText?: string | null;
	metadata?: {
		lqip?: string | null;
		dimensions?: {
			width?: number | null;
			height?: number | null;
			aspectRatio?: number | null;
		} | null;
		mimeType?: string | null;
		isOpaque?: boolean | null;
	} | null;
}

export interface SanityImageProps {
	image?: SanityImageData | null;
	alt?: string;
	className?: string;
	customRatio?: number | null;
	quality?: number;
	sizes?: string;
	priority?: boolean;
	fill?: boolean;
}

function SanityImage({
	image,
	alt,
	className,
	customRatio,
	quality = SANITY_IMAGE_QUALITY,
	sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
	priority = false,
	fill = false,
}: SanityImageProps): JSX.Element | null {
	const [isLoaded, setIsLoaded] = useState(false);
	const [error, setError] = useState(false);

	if (!image) return null;

	const { metadata, altText } = image;
	const { dimensions, lqip, isOpaque, mimeType } = metadata || {};
	const { crop } = image;
	const { width: rawWidth, aspectRatio } = dimensions || {};
	const width = rawWidth ?? undefined;
	// Two ratios, and they are not the same thing. `cropRatio` is the deliberate
	// crop the CDN should apply and only ever `customRatio`; `ratio` is what the
	// image will actually be delivered at, which is what `height` must describe.
	// Deriving the second from `aspectRatio` alone is how a cropped image ends up
	// squashed into a box it does not fill.
	const cropRatio = customRatio || undefined;
	const ratio = resolveRenderedRatio(aspectRatio, crop, customRatio);
	const height = width && ratio ? Math.round(width / ratio) : undefined;
	const imageAlt = alt || altText || '';

	// Every srcset candidate is built here, so the Sanity CDN is the only encoder
	// in the path. Before this, `src` was a fully-transformed Sanity URL at the
	// asset's native width and `next/image` re-encoded it — two lossy passes, and
	// the Sanity leg never saw `sizes` at all, so it always fetched the original.
	//
	// The clamp is what stops us paying for an upscale: `fit=max` would hand back
	// the source width anyway, but only after the CDN had transformed and cached an
	// entry per requested width. Candidates above the source therefore collapse
	// onto one URL — the browser downloads it once and gets exactly the pixels that
	// exist. The `3840w` descriptor still over-promises, which Next gives no
	// per-image way to trim (widths come from the global deviceSizes/imageSizes,
	// filtered by the smallest vw in `sizes`), and that stops mattering as soon as
	// the sources are larger than the slots.
	// `quality` rides the closure rather than the <Image> prop. get-img-props gates
	// its "not configured in images.qualities" warning on `qualityInt &&`, so
	// setting the prop made every Sanity image warn unless SANITY_IMAGE_QUALITY was
	// also listed in next.config -- a number the allowlist has no say over, since
	// findClosestQuality runs only inside the DEFAULT loader. Leaving the prop off
	// keeps the allowlist about the images it actually governs. The `??` is live:
	// next passes `quality: undefined` through to the loader.
	const loader: ImageLoader = ({
		width: requestedWidth,
		quality: requestedQuality,
	}) =>
		buildSanityImageUrl(image, {
			width: width ? Math.min(requestedWidth, width) : requestedWidth,
			quality: requestedQuality ?? quality,
			cropRatio,
		});

	// Not the rendered `src`. With a `loader` set, generateImgAttrs builds BOTH
	// attributes from it -- `src: loader({ width: widths[last] })` -- so this
	// string is handed to the loader as an argument the loader ignores, and never
	// reaches the DOM, the network, or `remotePatterns`. All it has to be is
	// non-empty when the asset is renderable, which is what the guard below and
	// the dev warning read it for.
	const src = buildSanityImageUrl(image, { width: 1, quality, cropRatio });

	if (process.env.NODE_ENV === 'development' && !imageAlt) {
		console.warn('[SanityImage] Missing alt text for image:', src);
	}

	if (!src) return null;

	const useFill = fill || !width || !height;

	// Only opaque images get the blur-up placeholder. Next builds it from an SVG
	// filter whose feFlood (black by default) fills every transparent pixel, so
	// an alpha PNG — every cut-out product shot — renders a black cloud that
	// `background-size: cover` stretches past the artwork and the container's
	// overflow then slices at a hard edge.
	//
	// `=== true`, not `!== false`: an absent value means *unknown*, and the two
	// wrong guesses aren't symmetric. Guessing "opaque" shows that black halo;
	// guessing "transparent" only skips a fade-in. JPEG is the exception worth
	// spelling out — the format has no alpha channel at all, so it is opaque by
	// definition. That keeps the placeholder working for cached GROQ payloads
	// serialized before `isOpaque` joined the projection, which would otherwise
	// lose their blur-up until the route or tag is revalidated.
	const canBlur =
		Boolean(lqip) && (isOpaque === true || mimeType === 'image/jpeg');

	return (
		<Image
			loader={loader}
			src={src}
			width={useFill ? undefined : width}
			height={useFill ? undefined : height}
			fill={useFill || undefined}
			sizes={sizes}
			priority={priority}
			fetchPriority={priority ? 'high' : undefined}
			alt={imageAlt}
			blurDataURL={canBlur ? lqip! : undefined}
			placeholder={canBlur ? 'blur' : undefined}
			onError={() => {
				setError(true);
				setIsLoaded(false);
			}}
			onLoad={() => setIsLoaded(true)}
			className={cn(
				{
					lazyload: !isLoaded,
					lazyloaded: isLoaded,
					loading: !isLoaded && !error,
				},
				className
			)}
		/>
	);
}

export default SanityImage;
