import Menu from '@/components/Menu';
import { motion } from 'motion/react';
import type { SettingsMenu } from 'sanity.types';

export function ToolBar({ menu }: { menu: SettingsMenu }) {
	return (
		<motion.div className="bg-background/85 backdrop-blur-xs text-foreground px-contain lg:hidden sticky bottom-0 w-full h-g-toolbar">
			{menu && (
				<Menu
					data={menu}
					className="flex items-center t-b-2 gap-2.5 select-none uppercase justify-between [&_a]:leading-g-toolbar [&_a]:h-g-toolbar"
				/>
			)}
		</motion.div>
	);
}
