'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import CustomPortableText from '@/components/CustomPortableText';
import { motion } from 'motion/react';
import type { PageProductSingleQueryResult } from 'sanity.types';
import { hasArrayValue } from '@/lib/utils';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';
import { localizePath } from '@/lib/i18n';
import ProductCard from '../../_components/ProductCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type Props = {
	data: NonNullable<PageProductSingleQueryResult>;
};

export default function PageProductSingle({ data }: Props) {
	const reveal = useReveal();
	const locale = useLocale();
	const breadcrumb = useTranslations('breadcrumb');
	const {
		title,
		badge,
		categories,
		brands,
		mainImage,
		price,
		purchaseLink,
		content,
		relatedProducts,
		defaultRelatedProducts,
	} = data || {};

	const displayRelated =
		relatedProducts && relatedProducts.length > 0
			? relatedProducts
			: defaultRelatedProducts;

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

	const firstCategory = hasArrayValue(categories)
		? (categories[0] as any)
		: null;
	// Keep the eyebrow concise: lead with the brand (the key identifier) and
	// let the breadcrumb carry the category. Products can be tagged with many
	// categories, so listing them all here reads as noise.
	const eyebrow = brandLabel || categoryLabel;

	return (
		<div className="p-x-max min-h-main py-10 lg:py-17.5">
			{/* Breadcrumb */}
			<motion.nav
				aria-label="Breadcrumb"
				className="t-l-2 uppercase text-foreground/60 mb-10 flex flex-wrap items-center gap-x-2 gap-y-1 lg:mb-16"
				{...reveal}
				transition={{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }}
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
			</motion.nav>

			{/* Product hero */}
			<div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 mb-16 lg:mb-24">
				{/* Image */}
				<motion.div
					className="relative aspect-4/3 overflow-hidden p-6 lg:col-span-7 lg:p-10"
					{...reveal}
					transition={{ duration: 0.8, delay: 0.05, ease: [0, 0.5, 0.5, 1] }}
				>
					{mainImage ? (
						<ImageBlock
							fill="contain"
							imageObj={mainImage as any}
							alt={title ?? ''}
							sizes="(max-width: 1024px) 100vw, 58vw"
							priority
						/>
					) : (
						<div className="absolute inset-0 bg-foreground/10" />
					)}
				</motion.div>

				{/* Details */}
				<div className="flex flex-col lg:col-span-5 lg:pt-2">
					{badge && badge.length > 0 && (
						<motion.div
							className="mb-4 flex flex-wrap gap-1.5"
							{...reveal}
							transition={{
								duration: 0.6,
								delay: 0.08,
								ease: [0, 0.71, 0.2, 1.01],
							}}
						>
							{badge.map((b: string) => (
								<Badge key={b}>{b}</Badge>
							))}
						</motion.div>
					)}

					{eyebrow && (
						<motion.p
							className="t-l-1 text-foreground"
							{...reveal}
							transition={{
								duration: 0.6,
								delay: 0.1,
								ease: [0, 0.71, 0.2, 1.01],
							}}
						>
							{eyebrow}
						</motion.p>
					)}

					<motion.h1
						className="mt-3 text-balance text-[clamp(1.75rem,3.2vw,2.75rem)] uppercase tracking-[-0.02em]"
						{...reveal}
						transition={{
							duration: 0.8,
							delay: 0.15,
							ease: [0, 0.71, 0.2, 1.01],
						}}
					>
						{title}
					</motion.h1>

					{price && (
						<motion.p
							className="t-spec font-semibold mt-5 text-foreground/75"
							{...reveal}
							transition={{
								duration: 0.6,
								delay: 0.2,
								ease: [0, 0.71, 0.2, 1.01],
							}}
						>
							{price}
						</motion.p>
					)}

					{purchaseLink && (
						<motion.div
							className="mt-6"
							{...reveal}
							transition={{
								duration: 0.6,
								delay: 0.25,
								ease: [0, 0.71, 0.2, 1.01],
							}}
						>
							<Button asChild>
								<a
									href={purchaseLink}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={`Buy ${title ?? 'this product'} (opens in a new tab)`}
									className="group min-w-60 transition-[background-color,filter] hover:brightness-[0.97] uppercase"
								>
									Buy it
									<span
										aria-hidden
										className="transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0"
									>
										↗
									</span>
								</a>
							</Button>
						</motion.div>
					)}

					{/* Why we chose it */}
					{content && content.length > 0 && (
						<motion.div
							className="mt-10 max-w-[60ch] border-t border-foreground/10 pt-8"
							{...reveal}
							transition={{
								duration: 0.8,
								delay: 0.3,
								ease: [0, 0.5, 0.5, 1],
							}}
						>
							<p className="t-l-2 mb-5 uppercase text-foreground/65">
								Why we chose it
							</p>
							<div className="text-[0.9375rem] leading-relaxed text-foreground/80 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-medium [&_h2]:uppercase [&_h2]:tracking-[-0.02em] [&_h2]:text-foreground [&_h2:first-child]:mt-0 [&_h3]:mt-6 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:uppercase [&_h3]:text-foreground [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">
								<CustomPortableText blocks={content as any} />
							</div>
						</motion.div>
					)}
				</div>
			</div>

			{/* Related products */}
			{displayRelated && displayRelated.length > 0 && (
				<section className="border-t border-foreground/10 pt-12 lg:pt-16">
					<div className="mb-6 flex items-baseline justify-between gap-4 lg:mb-8">
						<h2 className="t-l-2 uppercase text-foreground/70">
							{firstCategory?.title
								? `More ${firstCategory.title}`
								: 'More picks'}
						</h2>
						<Link
							href={localizePath('/products/all', locale)}
							className="t-l-2 inline-flex items-center uppercase text-foreground/70 transition-colors hover:text-mark-ink pointer-coarse:min-h-11"
						>
							All products →
						</Link>
					</div>
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 2xl:gap-x-10">
						{displayRelated.map((product, index) => (
							<ProductCard
								key={product._id}
								product={product}
								index={index}
							/>
						))}
					</div>
				</section>
			)}
		</div>
	);
}
