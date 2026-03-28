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
	const { dimensions, lqip } = metadata || {};
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

	return (
		<Image
			src={src}
			width={useFill ? undefined : width}
			height={useFill ? undefined : height}
			fill={useFill || undefined}
			sizes={sizes}
			quality={quality}
			priority={priority}
			alt={imageAlt}
			blurDataURL={lqip || undefined}
			placeholder={lqip ? 'blur' : undefined}
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
