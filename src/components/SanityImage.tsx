'use client';

import { JSX, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { buildImageSrc } from '@/lib/image-utils';
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
	format?: string;
	sizes?: string;
	priority?: boolean;
	fill?: boolean;
}

function SanityImage({
	image,
	alt,
	className,
	customRatio,
	quality = 80,
	format = 'webp',
	sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
	priority = false,
	fill = false,
}: SanityImageProps): JSX.Element | null {
	const [isLoaded, setIsLoaded] = useState(false);
	const [error, setError] = useState(false);

	if (!image) return null;

	const { metadata, altText } = image;
	const { dimensions, lqip, isOpaque, mimeType } = metadata || {};
	const { width: rawWidth, aspectRatio } = dimensions || {};
	const width = rawWidth ?? undefined;
	const height = width
		? Math.round(width / (customRatio || aspectRatio || 1))
		: undefined;
	const imageAlt = alt || altText || '';
	const src =
		buildImageSrc(image, { width, height, format: format as any, quality }) ||
		'';

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
			src={src}
			width={useFill ? undefined : width}
			height={useFill ? undefined : height}
			fill={useFill || undefined}
			sizes={sizes}
			quality={quality}
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
