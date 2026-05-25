'use client';

import React, { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
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
	const { header, footer, newsletter, sharing } = siteData || {};
	const pathname = usePathname();
	const gaID = siteData?.integrations?.gaID;
	const isCuratedSubpage = pathname.startsWith('/curated/');
	const isEventsCrew = pathname === '/events-crew';

	useEffect(() => {
		if (gaID) {
			gtag.pageview(pathname, gaID);
		}
	}, [gaID, pathname]);

	const headerData = useMemo(
		() => ({ ...header, siteTitle: sharing?.siteTitle }),
		[header, sharing?.siteTitle]
	);

	const footerData = useMemo(
		() => ({ ...footer, siteTitle: sharing?.siteTitle }),
		[footer, sharing?.siteTitle]
	);

	return (
		<LazyMotion features={domAnimation}>
			<AdaSkip />
			<Header data={headerData} isLightHeader={isCuratedSubpage} />
			<Main>
				{children}
				{!isEventsCrew && (
					<div className="border-t border-t-foreground/36">
						<Newsletter
							data={newsletter}
							className="p-x-max flex flex-wrap md:grid-cols-2 md:gap-6 py-6 w-full justify-between"
						/>
					</div>
				)}
			</Main>
			<Footer data={footerData} />
			<ToolBar menu={footerData.toolbarMenu} />
		</LazyMotion>
	);
}
