import { useLayoutEffect, useRef } from 'react';
import { pageTransitionFade } from '@/lib/animate';
import Menu from '@/components/Menu';
import { motion } from 'motion/react';
import type { GFooter, SettingsMenu } from 'sanity.types';

type FooterProps = GFooter & {
	siteTitle?: string;
	menu?: SettingsMenu;
};

export function Footer({ data }: { data: FooterProps }) {
	const { menu, note } = data || {};
	const footerRef = useRef<HTMLElement | null>(null);

	useLayoutEffect(() => {
		document.documentElement.style.setProperty(
			'--h-footer',
			`${footerRef?.current?.offsetHeight || 0}px`
		);
	}, []);

	return (
		<motion.footer
			ref={footerRef}
			initial="initial"
			animate="animate"
			variants={pageTransitionFade}
			className="bg-background text-foreground px-contain py-6 lg:py-10 lg:mb-0 empty:hidden"
		>
			{menu && (
				<Menu
					data={menu}
					className="mb-10 md:hidden flex items-center t-b-2 gap-2.5 select-none uppercase justify-between"
				/>
			)}
			{note && (
				<motion.p
					key="landing-title"
					variants={{
						hidden: { opacity: 0 },
						show: {
							opacity: 1,
						},
					}}
					transition={{
						duration: 0.3,
						delay: 1.5,
					}}
					initial="hidden"
					animate="show"
					className="t-l-2 uppercase text-right"
				>
					{note}
				</motion.p>
			)}
		</motion.footer>
	);
}
