import ImageBlock from '@/components/ImageBlock';
import type { PageProductSingleQueryResult } from 'sanity.types';

// The Sanity `mainImage` rendered into the product page's image frame. Kept as
// its own component because it has two callers that must produce identical
// geometry: the resolved gallery's fallback when Shopify has no images, and the
// Suspense fallback the frame shows while the Storefront lookup is in flight.
// If the two ever drift, the streamed swap becomes a layout shift.

/** The product's `mainImage` as `pageProductSingleQuery` projects it. */
export type ProductMainImageObj =
	NonNullable<PageProductSingleQueryResult>['mainImage'];

type Props = {
	imageObj: ProductMainImageObj;
	alt: string;
	/**
	 * Only for renders that are the real LCP element. Deliberately off when this
	 * is a Suspense fallback: static generation emits fallback markup *and* the
	 * resolved content into the same HTML, and the hoisted high-priority image
	 * preload survives React's swap — so priority there means fetching this
	 * image at high priority on every page load and then discarding it, in
	 * competition with the Shopify image that actually paints.
	 */
	priority?: boolean;
};

export default function ProductMainImage({ imageObj, alt, priority }: Props) {
	// Gate on the asset, not on either wrapper object: `mainImage` is truthy as
	// soon as an editor fills in any of its fields, and `image` is truthy as soon
	// as alt text is typed, so both can exist with no asset picked. ImageBlock
	// bails on a null `image` and SanityImage bails on the empty src an assetless
	// one produces — but ImageBlock still emits its img-object-contain wrapper
	// around that nothing, so anything short of this check leaves an empty frame
	// with no placeholder at all.
	if (!imageObj?.image?.asset) {
		return <div className="absolute inset-0 bg-foreground/10" />;
	}

	return (
		// The inset lives on this positioned wrapper, not as padding on the frame:
		// `img-object-contain` is absolutely positioned at 100%/100%, and
		// percentages there resolve against the *padding* box — so padding on the
		// parent never reaches the image.

		<ImageBlock
			fill="contain"
			imageObj={imageObj as any}
			alt={alt}
			sizes="(max-width: 1024px) 100vw, 58vw"
			priority={priority}
		/>
	);
}
