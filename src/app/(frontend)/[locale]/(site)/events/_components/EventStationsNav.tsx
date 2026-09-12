'use client';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import { cn } from '@/lib/utils';

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
			className="sticky top-header z-20 lg:z-auto bg-background overflow-x-auto lg:px-0 border-b border-foreground/20 border-t lg:border-t-0"
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
								'px-4 py-3 t-b-2 uppercase whitespace-nowrap border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground transition-colors border-r lg:border-y border-l',
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
