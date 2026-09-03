'use client';

import { GHeader, SettingsMenu, SiteDataQueryResult } from 'sanity.types';
import Link from 'next/link';
import { WordmarkSvg } from '@/components/WordmarkSvg';
import Menu from '@/components/Menu';
import MobileMenu from '@/components/MobileMenu';
import CartButton from '@/components/cart/CartButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';

type HeaderProps = GHeader & {
	siteTitle?: string;
	menu?: SettingsMenu;
	mobileMenu?: SiteDataQueryResult['mobileMenu'];
};

export function Header({
	data,
	isLightHeader = false,
}: {
	data: HeaderProps;
	isLightHeader?: boolean;
}) {
	const { siteTitle, menu, mobileMenu } = data || {};
	const locale = useLocale();
	// No scroll logic here. Over a full-bleed hero the header's background is a
	// function of `--header-progress` (the `[data-site-header]` rules in
	// globals.css), and the hero's own wrapper, HeroUnderlay, writes that
	// progress onto this element for as long as the hero is mounted.

	return (
		<header
			data-site-header
			className={cn(
				// No bg-*/backdrop-* utility here: the background is the
				// `[data-site-header]` rules in globals.css, so it has one home.
				'p-x-max h-header sticky top-0 z-header grid w-full grid-cols-2 lg:grid-cols-3 items-center leading-none',
				isLightHeader && 'theme-light'
			)}
		>
			{menu && (
				<Menu
					data={menu}
					className="lg:flex item-center gap-2.5 t-b-2 uppercase hidden select-none [&_a]:leading-header [&_a]:h-header"
				/>
			)}

			<Link
				href={resolveHref({ documentType: 'pHome', locale })!}
				aria-label={siteTitle}
				className="w-24 text-foreground mr-auto lg:mx-auto h-full flex items-center hover:opacity-90 transition-opacity"
			>
				<WordmarkSvg className="h-full" />
				<span className="sr-only">{siteTitle}</span>
			</Link>
			<div className="ml-auto flex text-foreground gap-3">
				<LanguageSwitcher className="max-lg:hidden" />

				<CartButton />
				<MobileMenu data={mobileMenu} siteTitle={siteTitle} />
			</div>
		</header>
	);
}
