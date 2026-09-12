import Link from 'next/link';
import { buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export default function AdaSkip() {
	return (
		<Link
			href="#main"
			className={cn(
				buttonVariants(),
				'top-[calc(var(--h-announcement, 0px)+10px)] left-contain fixed z-overlay -translate-y-full focus:translate-y-0'
			)}
		>
			Skip to content
		</Link>
	);
}
