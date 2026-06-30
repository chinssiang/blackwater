import { useLayoutEffect, useRef } from 'react';
import { pageTransitionFade } from '@/lib/animate';
import CustomLink from '@/components/CustomLink';
import ManageCookiesButton from '@/components/consent/ManageCookiesButton';
import { motion } from 'motion/react';
import type { GFooter, SettingsMenu } from 'sanity.types';
import { WordmarkSvg } from '@/components/WordmarkSvg';

type FooterProps = Omit<GFooter, 'menus'> & {
	siteTitle?: string;
	menus?: SettingsMenu[];
};

function NumberPrefix({ children }: { children: React.ReactNode }) {
	return (
		<span
			aria-hidden
			className="min-w-4 shrink-0 text-foreground/60 tabular-nums"
		>
			{children}
		</span>
	);
}

export function Footer({ data }: { data: FooterProps }) {
	const { menus, copyright } = data || {};
	const hasMenus = !!menus && menus.length > 0;
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
			className="bg-background text-foreground pt-section lg:pb-14 p-x-max empty:hidden pb-[max(calc(var(--height-g-toolbar)+3.5rem),3.5rem)]"
		>
			{hasMenus && (
				<nav
					aria-label="Footer"
					className="grid grid-cols-2 gap-12 md:grid-cols-3 w-full lg:w-3/5"
				>
					{menus!.map((menu, col) => (
						<ul key={menu?._id ?? col} className="flex flex-col gap-2 md:gap-3">
							{menu?.items?.map((item: any, i: number) => (
								<li key={item?._key ?? i}>
									<CustomLink
										link={item?.link}
										className="flex gap-3 text-foreground transition-colors hover:text-foreground/80 md:gap-10 t-l-1 uppercase"
									>
										<NumberPrefix>
											{col + 1}.{i + 1}
										</NumberPrefix>
										<span>{item?.title}</span>
									</CustomLink>
								</li>
							))}
							{col === menus!.length - 1 && (
								<li>
									<ManageCookiesButton
										className="t-l-1 uppercase transition-colors hover:text-foreground/80 flex gap-3 text-foreground md:gap-10"
										prefix={
											<NumberPrefix>
												{col + 1}.{(menu?.items?.length ?? 0) + 1}
											</NumberPrefix>
										}
									/>
								</li>
							)}
						</ul>
					))}
				</nav>
			)}
			<div className="flex justify-between mt-20 lg:mt-62 flex-col gap-4 md:flex-row items-start">
				<div className="flex flex-col gap-2">
					<WordmarkSvg className="h-3 w-auto" />
					{!hasMenus && (
						<ManageCookiesButton className="t-l-2 uppercase text-foreground/60 transition-colors hover:text-foreground self-start" />
					)}
				</div>
				{copyright && (
					<motion.small
						variants={{
							hidden: { opacity: 0 },
							show: { opacity: 1 },
						}}
						transition={{ duration: 0.3, delay: 1.5 }}
						initial="hidden"
						animate="show"
						className="t-l-2 lg:t-l-1 flex gap-2 uppercase text-foreground/60"
					>
						<span className="shrink-0">© {new Date().getFullYear()}</span>
						<span className="max-sm:whitespace-pre-line">{copyright}</span>
					</motion.small>
				)}
			</div>
		</motion.footer>
	);
}
