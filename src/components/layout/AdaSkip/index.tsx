import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/Button';

export default function AdaSkip() {
	return (
		<Link
			href="#main"
			className={cn(
				buttonVariants(),
				'top-[calc(var(--h-announcement, 0px)+10px)] left-contain z-overlay fixed -translate-y-full focus:translate-y-0'
			)}
		>
			Skip to content
		</Link>
	);
}
