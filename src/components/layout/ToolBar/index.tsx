import Menu from '@/components/Menu';
import { motion } from 'motion/react';
import type { SettingsMenu } from 'sanity.types';

export function ToolBar({ menu }: { menu: SettingsMenu }) {
	return (
		<motion.nav className="bg-background/85 text-foreground px-contain h-g-toolbar border-t-foreground/36 z-g-toolbar fixed bottom-0 w-full border-t backdrop-blur-xs lg:hidden">
			{menu && (
				<Menu
					data={menu}
					className="t-b-2 [&_a]:leading-g-toolbar [&_a]:h-g-toolbar flex items-center justify-between gap-2.5 uppercase select-none [&_a]:w-full [&_li]:flex-1 [&_li]:text-center [&_li:first-child]:text-left [&_li:last-child]:text-right"
				/>
			)}
		</motion.nav>
	);
}
