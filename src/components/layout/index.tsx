'use client';

import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { stripLocaleFromPath } from '@/lib/i18n';
import * as gtag from '@/lib/gtag';
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
	const {
		header,
		footer,
		newsletter,
		sharing,
		mobileMenu,
		toolbar,
	} = siteData || {};
	const pathname = usePathname();
	const gaID = siteData?.integrations?.gaID;
	const { path: strippedPath } = stripLocaleFromPath(pathname);
	const isProductsSection =
		strippedPath === '/products' || strippedPath.startsWith('/products/');
	const isEventsCrew = pathname === '/events-crew';

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

	return (
		<LazyMotion features={domAnimation}>
			<AdaSkip />
			<Header data={headerData} isLightHeader={isProductsSection} />
			<Main>
				{children}
				{!isEventsCrew && (
					<div data-hide-on-404 className="border-t border-foreground/36">
						<Newsletter
							data={newsletter}
							className="p-x-max flex flex-wrap md:grid-cols-2 md:gap-6 py-6 w-full justify-between"
						/>
					</div>
				)}
			</Main>
			<Footer data={footerData} />
			{!toolbar?.hideToolbar && <ToolBar menu={toolbar?.toolbarMenu} />}
		</LazyMotion>
	);
}
