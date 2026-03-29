'use client';

import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';
import { buildRgbaCssString } from '@/lib/image-utils';
import useWindowDimensions from '@/hooks/useWindowDimensions';
import { motion, useInView } from 'motion/react';

type TextRevealProps = {
	text: string;
	textColor?: any;
	className?: string;
	htmlTag?: string;
	handleAnimationCompleteAction?: (completed: boolean) => void;
};

export function TextReveal({
	text,
	textColor,
	className = '',
	htmlTag,
	handleAnimationCompleteAction,
}: TextRevealProps) {
	const CompTag = htmlTag || 'span';

	const { isSm } = useWindowDimensions();

	const animationConfig = useMemo(
		() => ({
			delay: isSm ? 0.2 : 0.36,
			duration: 0.2,
		}),
		[isSm]
	);

	const [lines, setLines] = useState([text]);
	const containerRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLSpanElement>(null);
	const isInView = useInView(containerRef, {
		once: true,
		margin: '0px 0px -10% 0px', // Trigger slightly before fully in view
	});

	const textColorStyle = useMemo(() => {
		const cssString = textColor ? buildRgbaCssString(textColor) : false;
		return cssString || undefined;
	}, [textColor]);

	const splitTextIntoLines = useCallback(
		(text: string, maxWidth: number): string[] => {
			if (!measureRef.current || maxWidth <= 0) return [text];

			const words = text.split(' ');
			const lines: string[] = [];
			let currentLine = '';

			for (const word of words) {
				const testLine = currentLine ? `${currentLine} ${word}` : word;

				// Measure the width of the test line
				measureRef.current.textContent = testLine;
				const lineWidth = measureRef.current.getBoundingClientRect().width;

				if (lineWidth <= maxWidth) {
					currentLine = testLine;
				} else {
					// If current line is not empty, push it and start new line
					if (currentLine) {
						lines.push(currentLine);
						currentLine = word;
					} else {
						// Single word is too long, just add it anyway
						lines.push(word);
					}
				}
			}

			// Add the last line if it exists
			if (currentLine) {
				lines.push(currentLine);
			}

			return lines.length > 0 ? lines : [text];
		},
		[]
	);

	const updateLines = useCallback(() => {
		if (!containerRef.current || !measureRef.current) return;

		const containerWidth = containerRef.current.getBoundingClientRect().width;
		const availableWidth = containerWidth - 30;
		const newLines = splitTextIntoLines(text, availableWidth);
		setLines(newLines);
	}, [text, splitTextIntoLines]);

	useEffect(() => {
		// Initial calculation with a small delay to ensure DOM is ready
		const timeoutId = setTimeout(updateLines, 0);

		// Update on resize
		let resizeTimeoutId: ReturnType<typeof setTimeout>;
		const resizeObserver = new ResizeObserver(() => {
			// Debounce resize events to improve performance
			clearTimeout(resizeTimeoutId);
			resizeTimeoutId = setTimeout(updateLines, 200);
		});

		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}

		return () => {
			clearTimeout(timeoutId);
			clearTimeout(resizeTimeoutId);
			resizeObserver.disconnect();
		};
	}, [updateLines]);

	return (
		<div
			className={cn('relative overflow-hidden', className, {
				'text-foreground': !textColor,
			})}
			ref={containerRef}
			style={{
				...(textColorStyle && { color: textColorStyle }),
			}}
		>
			{React.createElement(CompTag, { className: 'sr-only' }, text)}
			{/* Invisible measuring element with same styles */}
			<span
				ref={measureRef}
				className={cn(
					'pointer-events-none absolute -top-full left-0 whitespace-nowrap opacity-0'
				)}
				aria-hidden="true"
			/>

			{/* Rendered lines */}
			{lines.map((line, index, array) => {
				const isLast = index == array.length - 1;
				const delayBasis = index * animationConfig.delay;
				return (
					<div key={index} className="relative inline-block overflow-hidden">
						<motion.div
							key={index}
							className="absolute inset-0 z-20"
							style={{
								backgroundColor: textColorStyle || 'var(--foreground)',
							}}
							initial={{ x: '-101%' }}
							animate={{ x: isInView ? '101%' : '-101%' }}
							transition={{
								duration: animationConfig.duration + 0.1,
								ease: [0.0, 0.5, 0.5, 1.0],
								delay: delayBasis + 0.8,
							}}
						/>
						<motion.span
							initial={{ opacity: 0 }}
							animate={{ opacity: isInView ? 1 : 0 }}
							transition={{
								duration: animationConfig.duration,
								delay: delayBasis + 1,
							}}
							onAnimationComplete={() => {
								if (isLast) {
									handleAnimationCompleteAction &&
										handleAnimationCompleteAction(true);
								}
							}}
						>
							{line}
						</motion.span>
					</div>
				);
			})}
		</div>
	);
}
