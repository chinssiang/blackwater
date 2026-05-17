'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type NavItem = { id: string; label: string };

export default function EventStationsNav({ items }: { items: NavItem[] }) {
	const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
	const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
	const navRef = useRef<HTMLElement>(null);

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
		const link = linkRefs.current[activeId];
		const nav = navRef.current;
		if (!link || !nav) return;
		const linkLeft = link.offsetLeft;
		const linkRight = linkLeft + link.offsetWidth;
		const { scrollLeft, clientWidth } = nav;
		if (linkLeft < scrollLeft) {
			nav.scrollLeft = linkLeft;
		} else if (linkRight > scrollLeft + clientWidth) {
			nav.scrollLeft = linkRight - clientWidth;
		}
	}, [activeId]);

	return (
		<nav
			ref={navRef}
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
