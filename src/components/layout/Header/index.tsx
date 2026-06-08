'use client';

import { GHeader, SettingsMenu } from 'sanity.types';
import Link from 'next/link';
import { LogoSvg } from '@/components/LogoSvg';
import Menu from '@/components/Menu';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { LocationCurrentTime } from '@/components/LocationCurrentTime';
import { cn } from '@/lib/utils';
import { useWindowScroll } from '@/hooks/useWindowScroll';
import { useLocale } from '@/components/LocaleProvider';
import { resolveHref } from '@/lib/routes';

// matches --height-header in globals.css
const HEADER_HEIGHT = 52;

type HeaderProps = GHeader & {
	siteTitle?: string;
	menu?: SettingsMenu;
};

export function Header({
	data,
	isLightHeader = false,
}: {
	data: HeaderProps;
	isLightHeader?: boolean;
}) {
	const { siteTitle, menu } = data || {};
	const locale = useLocale();
	const [{ y }] = useWindowScroll() as [
		{ x: number | null; y: number | null },
		(...args: unknown[]) => void,
	];
	const isScrolled = (y ?? 0) > HEADER_HEIGHT;

	return (
		<header
			className={cn(
				'p-x-max h-header sticky top-0 z-10 grid w-full grid-cols-2 lg:grid-cols-3 items-center leading-none transition-colors bg-background/95 backdrop-blur-xs',
				isLightHeader && 'theme-light'
			)}
		>
			{menu && (
				<Menu
					data={menu}
					className="lg:flex item-center gap-2.5 t-b-2 uppercase hidden select-none [&_a]:leading-header [&_a]:h-header"
				/>
			)}

			<Link
				href={resolveHref({ documentType: 'pHome', locale })!}
				aria-label={siteTitle}
				className="w-24 text-foreground mr-auto lg:mx-auto h-full flex items-center hover:opacity-90 transition-opacity"
			>
				<LogoSvg className="h-full" />
				<span className="sr-only">{siteTitle}</span>
			</Link>
			<div className="ml-auto flex text-foreground gap-3">
				<LanguageSwitcher />
				<div className="t-b-2 flex items-center gap-1 uppercase">
					<LocationCurrentTime />
					<span>(TPE)</span>
				</div>
			</div>
		</header>
	);
}
