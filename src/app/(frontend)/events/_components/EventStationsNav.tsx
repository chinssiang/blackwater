'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type NavItem = { id: string; label: string };

export default function EventStationsNav({ items }: { items: NavItem[] }) {
	const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
	const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

	useEffect(() => {
		const sections = items
			.map((it) => document.getElementById(it.id))
			.filter((el): el is HTMLElement => el !== null);
		if (sections.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((e) => e.isIntersecting);
				if (visible.length === 0) return;
				const topmost = visible.reduce((a, b) =>
					a.boundingClientRect.top < b.boundingClientRect.top ? a : b
				);
				setActiveId(topmost.target.id);
			},
			{
				// Activation band: just below sticky nav (≈48px), strip covering top ~40% of viewport.
				rootMargin: '-48px 0px -60% 0px',
				threshold: 0,
			}
		);

		sections.forEach((s) => observer.observe(s));
		return () => observer.disconnect();
	}, [items]);

	useEffect(() => {
		if (!activeId) return;
		linkRefs.current[activeId]?.scrollIntoView({
			behavior: 'smooth',
			inline: 'nearest',
			block: 'nearest',
		});
	}, [activeId]);

	return (
		<nav className="sticky top-header z-20 bg-background overflow-x-auto p-x-max border-b border-foreground/20 border-t lg:border-none">
			<div className="flex gap-0">
				{items.map((item, i) => {
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
