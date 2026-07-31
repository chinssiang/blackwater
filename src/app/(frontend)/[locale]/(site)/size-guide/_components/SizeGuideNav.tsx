'use client';

import type { MouseEvent } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { readRootPxVar, useScrollSpy } from '@/hooks/useScrollSpy';
import { cn } from '@/lib/utils';
import type { SizeGuideSectionData } from './SizeGuideSection';

const ITEM_CLASS =
	'block rounded-full px-3.5 py-1.5 t-l-1 uppercase whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground';
const ITEM_ACTIVE = 'bg-foreground text-background';
const ITEM_IDLE = 'hover:opacity-60';

// Height of this nav when it renders as the sticky mobile strip
// (py-3 + the 24px pill row). At lg it's a static sidebar, where the extra
// allowance just pads the activation band harmlessly.
const MOBILE_STRIP_HEIGHT = 48;

// The sticky stack occluding the viewport top, read from the same CSS vars the
// layout sticks with (`top-header`), so a header or announcement-bar change
// propagates here instead of stranding a hardcoded pixel count.
const getStickyStackOffset = () =>
	readRootPxVar('--h-header') +
	readRootPxVar('--h-announcement') +
	MOBILE_STRIP_HEIGHT;

// Own the navigation instead of letting the anchor's default action run: the
// browser's fragment scroll targets the marginless panel wrapper (landing the
// section under the sticky stack), competes with the section's own corrected
// scrollIntoView, and a same-hash re-click fires no hashchange at all.
// pushState updates the URL without scrolling; the synthetic hashchange lets
// the owning section activate the tab and scroll with its scroll margin — one
// mechanism for first clicks and re-clicks alike. Modified clicks (new tab,
// middle-click) keep the default so the href still works as a real link.
const navigateToHash = (event: MouseEvent, value: string) => {
	if (
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey ||
		event.button !== 0
	) {
		return;
	}
	event.preventDefault();
	window.history.pushState(null, '', `#${value}`);
	window.dispatchEvent(new HashChangeEvent('hashchange'));
};

/**
 * Table of contents for the size guide: a sticky sidebar at lg, a horizontal
 * pill strip below it. Every link is a `#chart-slug` anchor whose click is
 * translated into a hashchange, so tab activation stays with the listener each
 * section already runs for product deep-links — there is no second mechanism.
 */
export default function SizeGuideNav({
	sections,
	className,
}: {
	sections: SizeGuideSectionData[];
	className?: string;
}) {
	const t = useTranslations('sizeGuide');
	const { activeId, setActiveId, linkRefs, containerRef } =
		useScrollSpy<HTMLUListElement>(
			sections.map((section) => section.id),
			getStickyStackOffset
		);

	if (!sections.length) return null;

	return (
		<nav
			aria-label={t.navAria}
			className={cn(
				'sticky top-header z-20 bg-background/95 backdrop-blur-xs',
				'lg:z-auto lg:bg-transparent lg:backdrop-blur-none',
				className
			)}
		>
			<ul
				ref={containerRef}
				className="scrollbar-none flex gap-1 overflow-x-auto py-3 lg:flex-col lg:overflow-x-visible lg:py-0"
			>
				{sections.map((section) => {
					const isActive = section.id === activeId;
					return (
						<li key={section.id}>
							<a
								ref={(element) => {
									linkRefs.current[section.id] = element;
								}}
								href={`#${section.tabs[0].value}`}
								aria-current={isActive ? 'true' : undefined}
								onClick={(event) => {
									setActiveId(section.id);
									navigateToHash(event, section.tabs[0].value);
								}}
								className={cn(ITEM_CLASS, isActive ? ITEM_ACTIVE : ITEM_IDLE)}
							>
								{section.title}
							</a>

							{/* Chart names expand under the active section only, and only in
							    the sidebar — they would wreck the mobile strip. These show the
							    full chart title, not the short tab label. */}
							{isActive && (
								<ul className="mt-1 hidden lg:block">
									{section.tabs.map((tab) => (
										<li key={tab.value}>
											<a
												href={`#${tab.value}`}
												onClick={(event) => navigateToHash(event, tab.value)}
												className={cn(ITEM_CLASS, ITEM_IDLE, 'ml-3')}
											>
												{tab.title}
											</a>
										</li>
									))}
								</ul>
							)}
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
