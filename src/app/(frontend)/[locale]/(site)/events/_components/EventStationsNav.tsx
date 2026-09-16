'use client';

import { cn } from '@/lib/utils';
import { useScrollSpy } from '@/hooks/useScrollSpy';

type NavItem = { id: string; label: string };

export default function EventStationsNav({ items }: { items: NavItem[] }) {
	// Activation band: just below sticky nav (≈48px), strip covering top ~40% of viewport.
	const { activeId, setActiveId, linkRefs, containerRef } =
		useScrollSpy<HTMLElement>(
			items.map((item) => item.id),
			() => 48
		);

	return (
		<nav
			ref={containerRef}
			className="top-header bg-background border-foreground/20 sticky z-20 overflow-x-auto border-t border-b lg:z-auto lg:border-t-0 lg:px-0"
		>
			<div className="flex gap-0">
				{items.map((item) => {
					const isActive = item.id === activeId;
					return (
						<a
							key={item.id}
							ref={(el) => {
								linkRefs.current[item.id] = el;
							}}
							href={`#${item.id}`}
							onClick={() => setActiveId(item.id)}
							className={cn(
								't-b-2 border-foreground/20 focus-visible:ring-foreground border-r border-l px-4 py-3 whitespace-nowrap uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset lg:border-y',
								isActive
									? 'bg-foreground text-background'
									: 'hover:bg-foreground hover:text-background'
							)}
						>
							{item.label}
						</a>
					);
				})}
			</div>
		</nav>
	);
}
