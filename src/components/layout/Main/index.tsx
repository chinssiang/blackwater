import { usePathname } from 'next/navigation';
import { pageTransitionFade } from '@/lib/animate';
import { motion } from 'motion/react';

export function Main({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	return (
		<motion.main
			id="main"
			key={pathname}
			initial="initial"
			animate="animate"
			variants={pageTransitionFade}
			className="min-h-main"
		>
			{children}
		</motion.main>
	);
}
