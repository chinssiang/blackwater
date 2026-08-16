'use client';

import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { isLightThemePath, shouldHideGlobalNewsletter } from '@/lib/routes';
import * as gtag from '@/lib/gtag';
import { CartProvider } from '@/components/cart/CartProvider';
import CartDrawer from '@/components/cart/CartDrawer';
import AdaSkip from './AdaSkip';
import { Footer } from './Footer';
import { Header } from './Header';
import { Newsletter } from './Newsletter';
import { ToolBar } from './ToolBar';
import { Main } from './Main';
import { LazyMotion, domAnimation } from 'motion/react';

type LayoutProps = {
	children: React.ReactNode;
	siteData: any;
};
export function Layout({ children, siteData }: LayoutProps) {
	const { header, footer, newsletter, sharing, mobileMenu, toolbar } =
		siteData || {};
	const pathname = usePathname();
	const gaID = siteData?.integrations?.gaIDs?.[0];
	const isLightSection = isLightThemePath(pathname);
	const hideNewsletter = shouldHideGlobalNewsletter(pathname);

	useEffect(() => {
		if (gaID) {
			gtag.pageview(pathname, gaID);
		}
	}, [gaID, pathname]);

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
		() => ({ ...header, siteTitle: sharing?.siteTitle, mobileMenu }),
		[header, sharing?.siteTitle, mobileMenu]
	);

	const footerData = useMemo(
		() => ({ ...footer, siteTitle: sharing?.siteTitle }),
		[footer, sharing?.siteTitle]
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
