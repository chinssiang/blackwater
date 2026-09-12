import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import CustomLink from '@/components/CustomLink';
import ManageCookiesButton from '@/components/consent/ManageCookiesButton';
import type { GFooter, SettingsMenu } from 'sanity.types';
import { WordmarkSvg } from '@/components/WordmarkSvg';
import Link from 'next/link';

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
	const { menus, copyright, siteTitle } = data || {};
	const hasMenus = !!menus && menus.length > 0;
	const footerRef = useRef<HTMLElement | null>(null);

	useLayoutEffect(() => {
		document.documentElement.style.setProperty(
			'--h-footer',
			`${footerRef?.current?.offsetHeight || 0}px`
		);
	}, []);

	return (
		<footer
			ref={footerRef}
			className="reveal bg-background text-foreground pt-section lg:pb-14 p-x-max empty:hidden pb-[max(calc(var(--height-g-toolbar)+3.5rem),3.5rem)]"
			style={{ '--reveal-duration': '0.4s' } as CSSProperties}
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
										// py-1.5: `t-l-1` is 12px/1, so the row was a 12px
										// tap target against the 24px minimum.
										className="flex gap-3 py-1.5 text-foreground transition-colors hover:text-foreground/80 md:gap-10 t-l-1 uppercase"
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
										className="hover:text-foreground/80 flex gap-3 text-foreground md:gap-10"
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
				{/* The wordmark is the only content, so the link needs its own
				    accessible name — an <svg> of bare <path>s exposes none. */}
				<Link href="/" aria-label={siteTitle ? `${siteTitle} — home` : 'Home'}>
					<WordmarkSvg className="h-3 w-auto" />
				</Link>
				{!hasMenus && (
					<ManageCookiesButton className="t-l-2 text-foreground/60 hover:text-foreground ml-auto" />
				)}
				{copyright && (
					<small
						className="reveal t-l-2 flex gap-2 uppercase text-foreground/60"
						style={
							{
								'--reveal-duration': '0.3s',
								'--reveal-delay': '1.5s',
							} as CSSProperties
						}
					>
						<span className="shrink-0">© {new Date().getFullYear()}</span>
						<span className="max-sm:whitespace-pre-line">{copyright}</span>
					</small>
				)}
			</div>
		</footer>
	);
}
