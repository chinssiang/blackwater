import { cn } from '@/lib/utils';

interface CaptionProps {
	caption: string;
	className?: string;
	classNameDot?: string;
}

export default function Caption({
	caption,
	className,
	classNameDot = 'bg-neon',
}: CaptionProps) {
	if (!caption) return null;
	return (
		<p
			className={cn(
				't-l-1 flex items-center justify-start gap-2 select-none',
				className
			)}
		>
			<span className={cn('size-2 rounded-xl', classNameDot)}></span>
			<span className="leading-none">{caption}</span>
		</p>
	);
}
