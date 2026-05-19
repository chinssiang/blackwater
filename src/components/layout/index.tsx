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
				<div className="border-t border-t-foreground/36 ">
					<Newsletter
						data={newsletter}
						className="px-contain grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[400px_1fr] gap-6 items-center md:justify-center mx-auto py-6 w-full flex-wrap max-w-lg"
					/>
				</div>
			</Main>
			<Footer data={footerData} />
			<ToolBar menu={footerData.toolbarMenu} />
		</LazyMotion>
	);
}
