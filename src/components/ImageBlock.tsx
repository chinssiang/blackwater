'use client';

import { JSX } from 'react';
import { cn } from '@/lib/utils';
import { buildImageSrc } from '@/lib/image-utils';
import SanityImage from '@/components/SanityImage';
import Caption from '@/components/Caption';
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
	breakpoint?: number;
	quality?: number;
	format?: string;
	sizes?: string;
	priority?: boolean;
}

function ImageBlock({
	imageObj,
	alt,
	className,
	fill,
	breakpoint = 768,
	quality = 80,
	format = 'webp',
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

	const { metadata } = image;
	const { dimensions } = metadata || {};
	const { width: rawWidth, aspectRatio } = dimensions || {};
	const width = rawWidth ?? undefined;
	const height = width
		? Math.round(width / (customRatio || aspectRatio || 1))
		: undefined;
	const src =
		buildImageSrc(image, { width, height, format: format as any, quality }) ||
		'';

	const imageEl = (
		<SanityImage
			image={image}
			alt={alt}
			customRatio={customRatio}
			quality={quality}
			format={format}
			sizes={sizes}
			priority={priority}
			fill={!width || !height}
			className={className}
		/>
	);

	let content: JSX.Element | null;

	if (responsiveImage) {
		const { dimensions: rDimensions } = responsiveImage.metadata || {};
		const rWidth = rDimensions?.width ?? undefined;
		const rHeight = rWidth
			? Math.round(
					rWidth / (customRatioMobile || rDimensions?.aspectRatio || 1)
				)
			: undefined;
		const responsiveSrc =
			buildImageSrc(responsiveImage, {
				width: rWidth,
				height: rHeight,
				format: format as any,
				quality,
			}) || '';

		content = (
			<picture className={cn(fillClass, className)}>
				<source
					media={`(min-width: ${breakpoint + 1}px)`}
					srcSet={src}
					width={width}
					height={height}
				/>
				<source
					media={`(max-width: ${breakpoint}px)`}
					srcSet={responsiveSrc}
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
