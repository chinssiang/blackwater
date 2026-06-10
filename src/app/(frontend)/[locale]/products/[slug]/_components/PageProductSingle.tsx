'use client';

import Link from 'next/link';
import ImageBlock from '@/components/ImageBlock';
import CustomPortableText from '@/components/CustomPortableText';
import { motion } from 'motion/react';
import type { PageProductSingleQueryResult } from 'sanity.types';
import {
	hasArrayValue,
	appendReferralParams,
	REFERRAL_SOURCE,
} from '@/lib/utils';
import { useReveal } from '@/hooks/useReveal';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';
import { resolveHref } from '@/lib/routes';
import { localizePath } from '@/lib/i18n';
import ProductCard from '../../_components/ProductCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from '@/components/ui/Accordion';

type Props = {
	data: NonNullable<PageProductSingleQueryResult>;
};

export default function PageProductSingle({ data }: Props) {
	const reveal = useReveal();
	const locale = useLocale();
	const breadcrumb = useTranslations('breadcrumb');
	const productText = useTranslations('products');
	const {
		title,
		slug,
		badge,
		categories,
		brands,
		mainImage,
		price,
		purchaseLink,
		content,
		whyUseIt,
		whoIsItFor,
		whenReachForIt,
		metadata,
		relatedProducts,
		defaultRelatedProducts,
	} = data || {};

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
								<Badge key={b}>
									{(productText.badges as Record<string, string>)[b] ?? b}
								</Badge>
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
						className="mt-3 text-balance t-h-1 uppercase"
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
									href={appendReferralParams(purchaseLink, {
										source: REFERRAL_SOURCE,
										medium: 'referral',
										campaign: 'curated-products',
										content: slug ?? undefined,
									})}
									target="_blank"
									rel="noopener"
									aria-label={interpolate(productText.buyAriaLabel, {
										product: title ?? productText.thisProduct,
									})}
									className="group lg:w-60 transition-[background-color,filter] hover:brightness-[0.97] uppercase w-full"
								>
									{productText.buyIt}
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

					{content && content.length > 0 && (
						<motion.div
							className="mt-10 lg:max-w-[60ch] border-t border-foreground/10 pt-8"
							{...reveal}
							transition={{
								duration: 0.8,
								delay: 0.3,
								ease: [0, 0.5, 0.5, 1],
							}}
						>
							<p className="t-l-1 mb-5 uppercase text-foreground/65">
								{productText.whyWeChoseIt}
							</p>
							<div className="t-b-1 text-foreground/80 [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 leading-[1.4]">
								<CustomPortableText blocks={content as any} />
							</div>
						</motion.div>
					)}

					{staticSections.length > 0 && (
						<motion.div
							className="mt-8 lg:max-w-[60ch] border-t border-foreground/10"
							{...reveal}
							transition={{
								duration: 0.8,
								delay: 0.35,
								ease: [0, 0.5, 0.5, 1],
							}}
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
						</motion.div>
					)}

					{metadata && metadata.length > 0 && (
						<motion.div
							className="mt-8 max-w-[60ch] border-t border-foreground/10 pt-4"
							{...reveal}
							transition={{
								duration: 0.8,
								delay: 0.4,
								ease: [0, 0.5, 0.5, 1],
							}}
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
								? interpolate(productText.moreCategory, {
										category: firstCategory.title,
									})
								: productText.morePicks}
						</h2>
						<Link
							href={localizePath('/products/all', locale)}
							className="t-l-2 inline-flex items-center uppercase text-foreground/70 transition-colors hover:text-accent-foreground pointer-coarse:min-h-11"
						>
							{productText.allProducts}
						</Link>
					</div>
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 2xl:gap-x-10">
						{displayRelated.map((product, index) => (
							<ProductCard key={product._id} product={product} index={index} />
						))}
					</div>
				</section>
			)}
		</div>
	);
}
