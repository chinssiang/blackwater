import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/Button';

export default function AdaSkip() {
	return (
		<Link
			href="#main"
			className={cn(
				buttonVariants(),
				// Parked above the viewport from `top-0`; the offset lives only on the
				// focus translate, since a `top` offset would leave it on screen.
				'left-contain z-overlay fixed top-0 -translate-y-full focus:translate-y-[calc(var(--height-announcement)+10px)] motion-reduce:transition-none'
			)}
		>
			Skip to content
		</Link>
	);
}
