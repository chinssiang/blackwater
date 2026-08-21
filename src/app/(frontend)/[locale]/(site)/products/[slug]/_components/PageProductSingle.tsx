'use client';

import Link from 'next/link';
import type { ReactNode, CSSProperties } from 'react';
import CustomPortableText from '@/components/CustomPortableText';
import type { PageProductSingleQueryResult } from 'sanity.types';
import { hasArrayValue } from '@/lib/utils';
import { REVEAL_SOFT } from '@/lib/animate';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import SizeChartDialog, { SIZE_GUIDE_LINK_CLASS } from './SizeChartDialog';
import { isRenderable } from '@/components/SizeChartTable';
import { Badge } from '@/components/ui/Badge';
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from '@/components/ui/Accordion';

// Renders only what Sanity already has: title, copy, size guide. All three
// Shopify-dependent regions — gallery, buy column, related grid — arrive as
// slots holding streamed server components, so nothing here waits on a
// Storefront round trip.

// Explicitly the fields this component renders, not the whole query result.
// Everything crossing into a client component is serialized into the HTML and
// every later RSC response, so the payload used to carry both related-product
// arrays, the SEO `sharing` block and every commerce field — none of which are
// read here — on every product page.
type ProductData = NonNullable<PageProductSingleQueryResult>;

type Props = {
	data: Pick<
		ProductData,
		| 'title'
		| 'badge'
		| 'categories'
		| 'brands'
		| 'content'
		| 'whyUseIt'
		| 'whoIsItFor'
		| 'whenReachForIt'
		| 'metadata'
		| 'sizeChart'
	>;
	/**
	 * The image frame's contents: <ProductMainImage> directly for products with
	 * no Shopify handle, otherwise a streamed <ProductGalleryColumn>.
	 */
	gallerySlot: ReactNode;
	/** Streamed <ProductBuyColumn> — price, variants, buy button. */
	buySlot: ReactNode;
	/** Streamed <ProductRelatedGrid>. */
	relatedSlot: ReactNode;
};

export default function PageProductSingle({
	data,
	gallerySlot,
	buySlot,
	relatedSlot,
}: Props) {
	const locale = useLocale();
	const breadcrumb = useTranslations('breadcrumb');
	const productText = useTranslations('products');
	const {
		title,
		badge,
		categories,
		brands,
		content,
		whyUseIt,
		whoIsItFor,
		whenReachForIt,
		metadata,
		sizeChart,
	} = data || {};

	// One decision, made here: a chart with a table opens in place, and one
	// without falls back to the size guide page. The dialog owns no part of this
	// — a second copy of the predicate would drift and leave the animated
	// wrapper below rendering around nothing.
	const sizeGuideBase = resolveHref({ documentType: 'pSizeGuide', locale });
	// The #slug anchor only resolves for charts the size guide page renders, which
	// is exactly the set the fallback excludes — so the fallback links to the page
	// itself, and only the dialog gets the anchored deep link.
	const sizeGuideHref =
		sizeGuideBase && sizeChart?.slug
			? `${sizeGuideBase}#${sizeChart.slug}`
			: null;
	const sizeGuideControl = !sizeChart ? null : isRenderable(sizeChart) ? (
		<SizeChartDialog chart={sizeChart} sizeGuideHref={sizeGuideHref} />
	) : sizeGuideBase ? (
		<Link href={sizeGuideBase} className={SIZE_GUIDE_LINK_CLASS}>
			{productText.sizeGuide}
		</Link>
	) : null;

	// `whenReachForIt` is a GROQ conditional-projection union (richText OR list
	// variant); contentType isn't a true discriminant, so read it via `any`.
	const when = whenReachForIt as any;

	const staticSections = [
		hasArrayValue(whyUseIt) && {
			value: 'whyUseIt',
			title: productText.whyUseIt,
			contentType: 'richText',
			richText: whyUseIt,
		},
		hasArrayValue(whoIsItFor) && {
			value: 'whoIsItFor',
			title: productText.whoIsItFor,
			contentType: 'richText',
			richText: whoIsItFor,
		},
		when &&
			((when.contentType === 'richText' && hasArrayValue(when.richText)) ||
				(when.contentType === 'list' && hasArrayValue(when.list))) && {
				value: 'whenReachForIt',
				title: productText.whenReachForIt,
				contentType: when.contentType,
				richText: when.richText,
				list: when.list,
			},
	].filter(Boolean) as any[];

	const categoryLabel = hasArrayValue(categories)
		? categories
				.map((c: any) => c.title)
				.filter(Boolean)
				.join(', ')
		: null;
	const brandLabel = hasArrayValue(brands)
		? (brands as any[])
				.map((b: any) => b.title)
				.filter(Boolean)
				.join(', ')
		: null;

	// Keep the eyebrow concise: lead with the brand (the key identifier) and
	// let the breadcrumb carry the category. Products can be tagged with many
	// categories, so listing them all here reads as noise.
	const eyebrow = brandLabel || categoryLabel;

	return (
		<>
			<nav
				aria-label="Breadcrumb"
				className="p-x-max t-l-2 uppercase text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 lg:mb-16"
			>
				<Link
					href={resolveHref({ documentType: 'pProductIndex', locale })!}
					className="inline-flex items-center transition-colors hover:text-foreground pointer-coarse:min-h-11"
				>
					{breadcrumb.products}
				</Link>
				<span aria-hidden className="text-foreground/30">
					/
				</span>
				<span aria-current="page" className="text-foreground/90">
					{title}
				</span>
			</nav>

			<div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 mb-16 lg:mb-24">
				<div className="bg-background relative overflow-hidden lg:col-span-7">
					{gallerySlot}
				</div>

				<div className="p-x-max flex flex-col lg:col-span-5 lg:pl-0 lg:pt-2">
					{badge && badge.length > 0 && (
						<div
							className="reveal mb-4 flex flex-wrap gap-1.5"
							style={{ '--reveal-delay': '0.08s' } as CSSProperties}
						>
							{badge.map((b: string) => (
								<Badge key={b}>
									{(productText.badges as Record<string, string>)[b] ?? b}
								</Badge>
							))}
						</div>
					)}

					{eyebrow && <p className="t-l-1 text-foreground">{eyebrow}</p>}

					<h1 className="mt-3 text-balance t-h-1 uppercase">{title}</h1>

					{/* Price, variants and the buy button — everything that waits on
					    Shopify — arrive here as a streamed server component. */}
					{buySlot}

					{sizeGuideControl && (
						<div
							className="reveal mt-5"
							style={{ '--reveal-delay': '0.28s' } as CSSProperties}
						>
							{sizeGuideControl}
						</div>
					)}

					{content && content.length > 0 && (
						<div
							className="reveal mt-10 lg:max-w-[60ch] border-t border-foreground/10 pt-8"
							style={
								{ ...REVEAL_SOFT, '--reveal-delay': '0.3s' } as CSSProperties
							}
						>
							<p className="t-l-1 mb-5 uppercase text-foreground/65">
								{productText.whyWeChoseIt}
							</p>
							<div className="t-b-1 text-foreground/80 [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 leading-[1.4] text-pretty">
								<CustomPortableText blocks={content as any} />
							</div>
						</div>
					)}

					{staticSections.length > 0 && (
						<div
							className="reveal mt-8 lg:max-w-[60ch] border-t border-foreground/10"
							style={
								{ ...REVEAL_SOFT, '--reveal-delay': '0.35s' } as CSSProperties
							}
						>
							{staticSections.map((item: any) => (
								<div
									key={item.value}
									className="border-b border-foreground/10 py-4"
								>
									<p className="t-l-1 uppercase text-foreground/65">
										{item.title}
									</p>
									{item.contentType === 'richText' && item.richText && (
										<div className="t-b-1 mt-3 text-foreground/80 [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 leading-[1.4]">
											<CustomPortableText blocks={item.richText} />
										</div>
									)}
									{item.contentType === 'list' && item.list && (
										<div className="mt-3 flex flex-wrap gap-1.5">
											{item.list.map((li: any, idx: number) => (
												<Badge key={li._key ?? idx}>
													{li._type === 'reference' ? li.tag?.title : li.text}
												</Badge>
											))}
										</div>
									)}
								</div>
							))}
						</div>
					)}

					{metadata && metadata.length > 0 && (
						<div
							className="reveal mt-8 max-w-[60ch] border-t border-foreground/10 pt-4"
							style={
								{ ...REVEAL_SOFT, '--reveal-delay': '0.4s' } as CSSProperties
							}
						>
							<Accordion type="multiple">
								{metadata.map((item: any, i: number) => {
									const value = item._key ?? `meta-${i}`;
									return (
										<AccordionItem
											key={value}
											value={value}
											className="border-foreground/10 "
										>
											<AccordionTrigger className="t-l-2 uppercase text-foreground/65">
												{item.title}
											</AccordionTrigger>
											<AccordionContent>
												{item.contentType === 'richText' && item.richText && (
													<div className="t-b-1 text-foreground/80 [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">
														<CustomPortableText blocks={item.richText} />
													</div>
												)}
												{item.contentType === 'list' && item.list && (
													<div className="flex flex-wrap gap-1.5">
														{item.list.map((li: any, idx: number) => (
															<Badge key={li._key ?? idx}>
																{li._type === 'reference'
																	? li.tag?.title
																	: li.text}
															</Badge>
														))}
													</div>
												)}
											</AccordionContent>
										</AccordionItem>
									);
								})}
							</Accordion>
						</div>
					)}
				</div>
			</div>

			{/* Below the fold and Shopify-dependent, so it streams too. */}
			{relatedSlot}
		</>
	);
}
