import Menu from '@/components/Menu';
import { motion } from 'motion/react';
import type { SettingsMenu } from 'sanity.types';

export function ToolBar({ menu }: { menu: SettingsMenu }) {
	return (
		<motion.nav className="bg-background/85 backdrop-blur-xs text-foreground px-contain lg:hidden sticky bottom-0 w-full h-g-toolbar border-t border-t-foreground/36 z-g-toolbar">
			{menu && (
				<Menu
					data={menu}
					className="flex items-center t-b-2 gap-2.5 select-none uppercase justify-between [&_a]:w-full [&_a]:leading-g-toolbar [&_a]:h-g-toolbar [&_li]:text-center [&_li]:flex-1 [&_li:first-child]:text-left [&_li:last-child]:text-right"
				/>
			)}
		</motion.nav>
	);
}
