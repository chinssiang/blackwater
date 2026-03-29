import { GHeader, SettingsMenu } from 'sanity.types';
import Link from 'next/link';
import { LogoSvg } from '@/components/LogoSvg';
import Menu from '@/components/Menu';
import { LocationCurrentTime } from '@/components/LocationCurrentTime';
type HeaderProps = GHeader & {
	siteTitle?: string;
	menu?: SettingsMenu;
};

export function Header({ data }: { data: HeaderProps }) {
	const { siteTitle, menu } = data || {};

	return (
		<header className="p-x-max h-header sticky top-0 z-10 grid w-full grid-cols-2 lg:grid-cols-3 items-center bg-background leading-none">
			{menu && (
				<Menu
					data={menu}
					className="lg:flex item-center gap-2.5 t-b-2 uppercase hidden select-none [&_a]:leading-header [&_a]:h-header"
				/>
			)}

			<Link
				href="/"
				aria-label={siteTitle}
				className="w-24 text-foreground mr-auto lg:mx-auto h-full flex items-center hover:opacity-90 transition-opacity"
			>
				<LogoSvg className="h-full" />
				<span className="sr-only">{siteTitle}</span>
			</Link>
			<div className="t-b-2 ml-auto flex items-center gap-0.5 uppercase">
				<LocationCurrentTime />
				(TPE)
			</div>
		</header>
	);
}
