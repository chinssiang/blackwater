'use client';
import { motion } from 'motion/react';
import { fadeAnim } from '@/lib/animate';

export function AnimatedTitle({ title }: { title?: string }) {
	return (
		<motion.h1
			key="landing-title"
			initial="hide"
			animate="show"
			variants={fadeAnim}
			transition={{
				duration: 0.6,
				delay: 0.3,
				ease: [0, 0.71, 0.2, 1.01],
			}}
		>
			{title}
		</motion.h1>
	);
}
