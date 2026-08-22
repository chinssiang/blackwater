'use client';

import React, { useLayoutEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { isLightThemePath, shouldHideGlobalNewsletter } from '@/lib/routes';
import type { LayoutData } from '@/sanity/lib/siteData';
import { CartProvider } from '@/components/cart/CartProvider';
import CartDrawer from '@/components/cart/CartDrawer';
import AdaSkip from './AdaSkip';
import { Footer } from './Footer';
import { Header } from './Header';
import { Newsletter } from './Newsletter';
import { ToolBar } from './ToolBar';
import { Main } from './Main';
// `features` is a static import on purpose. Loading it lazily saves nothing
// here: LazyMotion's features only supply capabilities to the lightweight `m.*`
// components, and nothing in this repo uses those — every call site imports the
// full `motion.*`, which bundles its own feature set (ToolBar, Newsletter,
// MobileMenu and CartDrawerPanel all do, inside this same always-mounted
// shell). A lazy bundle would add an async chunk fetch for zero byte saving.
// Migrate those call sites to `m.*` first if this is ever worth revisiting.
import { LazyMotion, domAnimation } from 'motion/react';

type LayoutProps = {
	children: React.ReactNode;
	/** Narrowed by `pickLayoutData` — see the note there on why not the whole
	 *  siteData blob. */
	siteData: LayoutData;
};
export function Layout({ children, siteData }: LayoutProps) {
	const { header, footer, newsletter, siteTitle, mobileMenu, toolbar } =
		siteData || {};
	const pathname = usePathname();
	const isLightSection = isLightThemePath(pathname);
	const hideNewsletter = shouldHideGlobalNewsletter(pathname);
	// SPA pageview tracking lives in HeadTrackingCode — the one component
	// allowed to talk to gtag, so it stays behind the consent gate.

	useLayoutEffect(() => {
		const root = document.documentElement;
		if (toolbar?.hideToolbar) {
			root.style.setProperty('--height-g-toolbar', '0px');
		} else {
			root.style.removeProperty('--height-g-toolbar');
		}
		return () => {
			root.style.removeProperty('--height-g-toolbar');
		};
	}, [toolbar?.hideToolbar]);

	const headerData = useMemo(
		() => ({ ...header, siteTitle, mobileMenu }),
		[header, siteTitle, mobileMenu]
	);

	const footerData = useMemo(
		() => ({ ...footer, siteTitle }),
		[footer, siteTitle]
	);

	// The cart provider lives here rather than in a route layout because this is
	// the component that owns the header (and so the cart trigger). Four routes
	// render this chrome from outside the [locale] subtree — /email-signature,
	// /events-crew and both not-found fallbacks — and every one of them needs the
	// context. One mount here covers all of them, and wraps `children` too, so
	// product pages can add to the same cart.
	return (
		<CartProvider>
			<LazyMotion features={domAnimation}>
				<AdaSkip />
				<Header data={headerData} isLightHeader={isLightSection} />
				<Main key={pathname} className="animate-page-in">
					{children}
					{!hideNewsletter && (
						<div data-hide-on-404 className="border-t border-foreground/36">
							<Newsletter
								data={newsletter}
								setGlobalHeightVar={true}
								className="p-x-max flex flex-wrap md:grid-cols-2 md:gap-6 py-6 w-full justify-between"
							/>
						</div>
					)}
				</Main>
				<Footer data={footerData} />
				{!toolbar?.hideToolbar && <ToolBar menu={toolbar?.toolbarMenu} />}
				<CartDrawer settings={siteData?.cart} />
			</LazyMotion>
		</CartProvider>
	);
}
