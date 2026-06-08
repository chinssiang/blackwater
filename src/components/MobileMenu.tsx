'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { SiteDataQueryResult } from 'sanity.types';
import CustomLink from '@/components/CustomLink';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LocationCurrentTime } from '@/components/LocationCurrentTime';
import { LogoSvg } from '@/components/LogoSvg';
import { CloseIcon, MenuIcon } from '@/components/SvgIcons';
import { buttonVariants } from '@/components/ui/Button';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import { mobileMenuItem, mobileMenuList, mobileMenuPanel } from '@/lib/animate';
import { resolveHref } from '@/lib/routes';
import { cn } from '@/lib/utils';

type MobileMenuProps = {
	data?: SiteDataQueryResult['mobileMenu'];
	siteTitle?: string;
};

/**
 * Animated 3×3 grid ↔ X. The four corner squares + centre (the diagonals) are
 * always drawn and form the X; the four edge-midpoint squares fade out as the
 * menu opens, morphing the grid into an X. Under reduced motion the static
 * MenuIcon / CloseIcon swap instantly.
 */
function AnimatedMenuIcon({
	open,
	reduce,
}: {
	open: boolean;
	reduce: boolean;
}) {
	if (reduce) {
		return open ? (
			<CloseIcon className="size-[15px]" />
		) : (
			<MenuIcon className="size-[15px]" />
		);
	}

	const square = {
		width: 2.5,
		height: 2.5,
		fill: 'currentColor',
		stroke: 'currentColor',
		strokeWidth: 0.5,
	};

	return (
		<svg
			width="15"
			height="15"
			viewBox="0 0 15 15"
			fill="none"
			aria-hidden="true"
		>
			{/* Diagonals (4 corners + centre) — the persistent X skeleton */}
			<rect x="0.25" y="0.25" {...square} />
			<rect x="12.25" y="0.25" {...square} />
			<rect x="6.25" y="6.25" {...square} />
			<rect x="0.25" y="12.25" {...square} />
			<rect x="12.25" y="12.25" {...square} />
			{/* Edge midpoints — fade out on open to reveal the X */}
			<motion.g
				initial={false}
				animate={{ opacity: open ? 0 : 1 }}
				transition={{ duration: 0.2, ease: 'easeInOut' }}
			>
				<rect x="6.25" y="0.25" {...square} />
				<rect x="0.25" y="6.25" {...square} />
				<rect x="12.25" y="6.25" {...square} />
				<rect x="6.25" y="12.25" {...square} />
			</motion.g>
		</svg>
	);
}

export default function MobileMenu({ data, siteTitle }: MobileMenuProps) {
	const reduce = useReducedMotion() ?? false;
	const [open, setOpen] = useState(false);
	const t = useTranslations('nav');
	const locale = useLocale();

	const primary = data?.primaryMenu ?? [];
	const secondary = data?.secondaryMenu ?? [];
	const ctaLink = (data?.cta?.link ?? null) as {
		href?: string;
		isNewTab?: boolean;
		linkType?: 'internal' | 'external';
	} | null;
	const ctaLabel = data?.cta?.label ?? null;
	const hasCta = Boolean(ctaLink?.href && ctaLabel);

	if (!primary.length && !secondary.length && !hasCta) return null;

	const renderItem = (item: any, key: string, className?: string) =>
		item?.link?.href ? (
			<motion.li
				key={key}
				variants={mobileMenuItem}
				custom={reduce}
				className={className}
			>
				<CustomLink
					link={item.link}
					onLinkClickAction={() => setOpen(false)}
					className="inline-block"
				>
					{item.title}
				</CustomLink>
			</motion.li>
		) : null;

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				className="t-b-2 flex cursor-pointer items-center gap-1.5 uppercase lg:hidden"
				aria-label={open ? t.closeMenu : t.openMenu}
			>
				<AnimatedMenuIcon open={open} reduce={reduce} />
				<span>{t.menu}</span>
			</Dialog.Trigger>

			<Dialog.Portal forceMount>
				<AnimatePresence>
					{open && (
						<Dialog.Content asChild forceMount key="mobile-menu">
							<motion.div
								className="text-foreground bg-background fixed inset-0 z-[99] flex flex-col"
								variants={mobileMenuPanel}
								initial="hide"
								animate="show"
								exit="hide"
							>
								<Dialog.Title className="sr-only">{t.menu}</Dialog.Title>
								<Dialog.Description className="sr-only">
									{t.menu}
								</Dialog.Description>

								{/* Top bar: brand logo (left) + morphing close toggle (right),
								    aligned to the real header so the logo reads as "stayed". */}
								<div className="p-x-max h-header flex shrink-0 items-center">
									<Link
										href={resolveHref({ documentType: 'pHome', locale })!}
										aria-label={siteTitle}
										onClick={() => setOpen(false)}
										className="text-foreground flex h-full w-24 items-center transition-opacity hover:opacity-90"
									>
										<LogoSvg className="h-full" />
										<span className="sr-only">{siteTitle}</span>
									</Link>
									<Dialog.Close
										className="t-b-2 ml-auto flex cursor-pointer items-center gap-2 uppercase"
										aria-label={t.closeMenu}
									>
										<AnimatedMenuIcon open={open} reduce={reduce} />
										<span>{t.close}</span>
									</Dialog.Close>
								</div>

								<div className="px-contain flex flex-1 flex-col">
									<motion.ul
										className="t-h-2 flex text-foreground flex-col gap-4 pt-6 my-auto uppercase"
										variants={mobileMenuList}
										initial="hide"
										animate="show"
										exit="hide"
										custom={reduce}
									>
										{primary.map((item, i) => renderItem(item, `p-${i}`))}
									</motion.ul>
									{secondary.length > 0 && (
										<motion.ul
											className="t-b-1 text-foreground flex flex-col gap-2 pt-5 my-auto uppercase"
											variants={mobileMenuList}
											initial="hide"
											animate="show"
											exit="hide"
											custom={reduce}
										>
											{secondary.map((item, i) => renderItem(item, `s-${i}`))}
										</motion.ul>
									)}

									{/* Footer — language/time + CTA, pinned to the bottom */}
									<motion.div
										className="mt-auto flex flex-col gap-4 pt-8 pb-6"
										variants={mobileMenuList}
										initial="hide"
										animate="show"
										exit="hide"
										custom={reduce}
									>
										<motion.div
											variants={mobileMenuItem}
											custom={reduce}
											className="t-b-2 flex items-center gap-4 justify-between uppercase"
										>
											<div className="flex items-center gap-2">
												<LocationCurrentTime />
												<span>(TPE)</span>
											</div>
											<LanguageSwitcher onSelect={() => setOpen(false)} />
										</motion.div>

										{hasCta && ctaLink && (
											<motion.div variants={mobileMenuItem} custom={reduce}>
												<CustomLink
													link={ctaLink}
													onLinkClickAction={() => setOpen(false)}
													className={cn(
														buttonVariants({ variant: 'default', size: 'xl' }),
														'w-full'
													)}
												>
													{ctaLabel}
												</CustomLink>
											</motion.div>
										)}
									</motion.div>
								</div>
							</motion.div>
						</Dialog.Content>
					)}
				</AnimatePresence>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
