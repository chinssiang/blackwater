'use client';

import React, { useLayoutEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { LayoutData } from '@/sanity/lib/siteData';
import { shouldHideGlobalNewsletter } from '@/lib/routes';
import CartDrawer from '@/components/cart/CartDrawer';
import { CartProvider } from '@/components/cart/CartProvider';
import GlobalProgressBar from '@/components/progress/GlobalProgressBar';
import { ProgressProvider } from '@/components/progress/ProgressProvider';
import AdaSkip from './AdaSkip';
import Announcement, { type AnnouncementData } from './Announcement';
import { Footer } from './Footer';
import { Header } from './Header';
import { Main } from './Main';
import { Newsletter } from './Newsletter';
import { ToolBar } from './ToolBar';
import { LazyMotion, domAnimation } from 'motion/react';

type LayoutProps = {
	children: React.ReactNode;
	/** Narrowed by `pickLayoutData` — see the note there on why not the whole
	 *  siteData blob. */
	siteData: LayoutData;
	/** Null when hidden. */
	announcement?: AnnouncementData | null;
};
export function Layout({ children, siteData, announcement }: LayoutProps) {
	const { header, footer, newsletter, siteTitle, mobileMenu, toolbar } =
		siteData || {};
	const pathname = usePathname();
	const hideNewsletter = shouldHideGlobalNewsletter(pathname);

	// The page-navigation fade is applied from the SECOND route onward only, so
	// the first paint carries no `animate-page-in`. That rule starts <main> --
	// the whole page -- at `opacity: 0` via @starting-style, and Chrome does not
	// record an LCP candidate for a fully transparent element: measured on
	// production, it held the hero <h1> ineligible for ~480ms past FCP, which in
	// turn pulled the entire ~620KB script graph onto Lighthouse's simulated LCP
	// critical path (4.4s simulated against a 505ms observed LCP).
	//
	// Absence of the class is the FINAL state, so the prerendered HTML is already
	// correct with no JS and nothing is corrected after hydration -- the class is
	// only ever added later, on a navigation that by definition has JS.
	//
	// Latched during render rather than in an effect: <Main key={pathname}>
	// remounts in the same render as the pathname change, so an effect would set
	// the flag after @starting-style had already resolved without the class and
	// the first navigation would not fade. Latched rather than compared, so
	// navigating BACK to the entry route still fades.
	const [entryPathname] = useState(pathname);
	const [hasNavigated, setHasNavigated] = useState(false);
	if (!hasNavigated && pathname !== entryPathname) setHasNavigated(true);
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
	// The progress provider wraps the cart one for the same reason the comment
	// above gives, plus one of its own: it must sit ABOVE `<Main key={pathname}>`,
	// which remounts on every navigation and would tear the transition down
	// halfway through the very navigation it is reporting.
	return (
		<ProgressProvider>
			<CartProvider>
				<LazyMotion features={domAnimation}>
					<AdaSkip />
					<GlobalProgressBar />
					{announcement && <Announcement data={announcement} />}
					<Header data={headerData} />
					<Main
						key={pathname}
						className={hasNavigated ? 'animate-page-in' : undefined}
					>
						{children}
						{!hideNewsletter && (
							<div data-hide-on-404 className="border-foreground/36 border-t">
								<Newsletter
									data={newsletter}
									setGlobalHeightVar={true}
									className="p-x-max flex w-full flex-wrap justify-between py-6 md:grid-cols-2 md:gap-6"
								/>
							</div>
						)}
					</Main>
					<Footer data={footerData} />
					{!toolbar?.hideToolbar && <ToolBar menu={toolbar?.toolbarMenu} />}
					<CartDrawer settings={siteData?.cart} />
				</LazyMotion>
			</CartProvider>
		</ProgressProvider>
	);
}
