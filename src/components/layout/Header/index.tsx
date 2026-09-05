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

export function Header({ data }: { data: HeaderProps }) {
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
				// `fixed`, not `sticky`: out of flow, so a full-bleed hero can start at
				// the top of the viewport and this floats over it. `inset-x-0` rather
				// than `w-full` — out of flow there is no parent to be 100% of.
				'p-x-max h-header fixed inset-x-0 top-0 z-header grid grid-cols-2 lg:grid-cols-3 items-center leading-none'
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
