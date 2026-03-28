'use client';

import { JSX, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { buildImageSrc } from '@/lib/image-utils';
import Caption from '@/components/Caption';
import type {
	SanityImageAssetReference,
	SanityImageCrop,
	SanityImageHotspot,
} from 'sanity.types';

interface ImageWithMeta {
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

export interface ImageBlockObj {
	image?: ImageWithMeta | null;
	imageMobile?: ImageWithMeta | null;
	customRatio?: number | null;
	customRatioMobile?: number | null;
	caption?: string | null;
}

interface ImgProps {
	imageObj?: ImageBlockObj | null;
	alt?: string;
	className?: string;
	fill?: 'cover' | 'contain';
	breakpoint?: number;
	quality?: number;
	format?: string;
	sizes?: string;
	priority?: boolean;
}

function Img({
	imageObj,
	alt,
	className,
	fill,
	breakpoint = 768,
	quality = 80,
	format = 'webp',
	sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
	priority = false,
}: ImgProps): JSX.Element | null {
	const [isLoaded, setIsLoaded] = useState(false);
	const [error, setError] = useState(false);

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

	const { metadata, altText } = image;
	const { dimensions, lqip } = metadata || {};
	const { width: rawWidth, aspectRatio } = dimensions || {};
	const width = rawWidth ?? undefined;
	const height = width
		? Math.round(width / (customRatio || aspectRatio || 1))
		: undefined;
	const imageAlt = alt || altText || '';
	if (process.env.NODE_ENV === 'development' && !imageAlt) {
		console.warn('[Img] Missing alt text for image:', src);
	}
	const src =
		buildImageSrc(image, { width, height, format: format as any, quality }) ||
		'';

	let responsiveProps = null;
	if (responsiveImage) {
		const { dimensions: rDimensions } = responsiveImage.metadata || {};
		const rWidth = rDimensions?.width ?? undefined;
		const rHeight = rWidth
			? Math.round(
					rWidth / (customRatioMobile || rDimensions?.aspectRatio || 1)
				)
			: undefined;
		responsiveProps = {
			src:
				buildImageSrc(responsiveImage, {
					width: rWidth,
					height: rHeight,
					format: format as any,
					quality,
				}) || '',
			width: rWidth,
			height: rHeight,
		};
	}

	const imageEl = (
		<Image
			src={src}
			width={width}
			height={height}
			fill={!width || !height ? true : undefined}
			sizes={sizes}
			quality={quality}
			priority={priority}
			alt={imageAlt}
			blurDataURL={lqip || undefined}
			onError={() => {
				setError(true);
				setIsLoaded(false);
			}}
			onLoad={() => setIsLoaded(true)}
			className={cn({
				lazyload: !isLoaded,
				lazyloaded: isLoaded,
				loading: !isLoaded && !error,
				className,
			})}
		/>
	);

	const content = responsiveProps ? (
		<picture className={cn(fillClass, className)}>
			<source
				media={`(min-width: ${breakpoint + 1}px)`}
				srcSet={src}
				width={width}
				height={height}
			/>
			<source
				media={`(max-width: ${breakpoint}px)`}
				srcSet={responsiveProps.src}
				width={responsiveProps.width}
				height={responsiveProps.height}
			/>
			{imageEl}
		</picture>
	) : fillClass ? (
		<span className={cn(fillClass, className)}>{imageEl}</span>
	) : (
		imageEl
	);

	if (!caption) return content;

	return (
		<div className={cn('relative', className)}>
			{content}
			<Caption className="absolute bottom-2 left-2" caption={caption} />
		</div>
	);
}

export default Img;
