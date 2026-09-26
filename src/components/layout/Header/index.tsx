'use client';

import Link from 'next/link';
import { localizePath } from '@/lib/i18n';
import { resolveHref } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useSignedInHint } from '@/hooks/useSignedInHint';
import { chromeButtonClass } from '@/components/ChromeButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLocale, useTranslations } from '@/components/LocaleProvider';
import Menu from '@/components/Menu';
import MobileMenu from '@/components/MobileMenu';
import { WordmarkSvg } from '@/components/WordmarkSvg';
import CartButton from '@/components/cart/CartButton';
import { GHeader, SettingsMenu, SiteDataQueryResult } from 'sanity.types';

type HeaderProps = GHeader & {
	siteTitle?: string;
	menu?: SettingsMenu;
	mobileMenu?: SiteDataQueryResult['mobileMenu'];
};

export function Header({ data }: { data: HeaderProps }) {
	const { siteTitle, menu, mobileMenu } = data || {};
	const locale = useLocale();
	const t = useTranslations('nav');
	const signedIn = useSignedInHint();
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
				// `top` is the announcement bar's height (0 when there is none).
				'p-x-max h-header z-header fixed inset-x-0 top-(--height-announcement) grid grid-cols-2 items-center leading-none lg:grid-cols-3'
			)}
		>
			{menu && (
				<Menu
					data={menu}
					className="t-b-2 [&_a]:leading-header [&_a]:h-header hidden items-center gap-2.5 uppercase select-none lg:flex"
				/>
			)}

			<Link
				href={resolveHref({ documentType: 'pHome', locale })!}
				aria-label={siteTitle}
				className="text-foreground mr-auto flex h-full w-24 items-center transition-opacity hover:opacity-90 lg:mx-auto"
			>
				<WordmarkSvg className="h-full" />
				<span className="sr-only">{siteTitle}</span>
			</Link>
			<div className="text-foreground ml-auto flex gap-3">
				<LanguageSwitcher className="max-lg:hidden" />

				{/* The chrome never reads the session (that would take every page
				    out of static generation), so this is /account's last answer,
				    mirrored into a readable cookie -- see useSignedInHint. The
				    prerender always says "Account"; /account itself decides
				    between the sign-in form and the member's details. */}
				<Link
					href={localizePath('/account', locale)}
					className={chromeButtonClass}
				>
					{signedIn && (
						<span aria-hidden className="size-1.5 rounded-full bg-current" />
					)}
					{signedIn ? t.accountSignedIn : t.account}
				</Link>
				<CartButton />
				<MobileMenu data={mobileMenu} siteTitle={siteTitle} />
			</div>
		</header>
	);
}
