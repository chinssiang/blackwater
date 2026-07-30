'use client';

import { useEffect, useRef, useState } from 'react';
import SizeChartTable, { type SizeChart } from '@/components/SizeChartTable';
import { useTranslations } from '@/components/LocaleProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { SIZE_UNITS, type SizeUnit } from '@/lib/size-measurements';
import { cn } from '@/lib/utils';

export type SizeGuideSectionData = {
	_key?: string | null;
	title?: string | null;
	charts?: (SizeChart | null)[] | null;
};

// Tab identity. The slug is what a product's /size-guide#<slug> link points at,
// so it has to win over _id wherever one exists.
const tabValue = (chart: SizeChart) => chart.slug || chart._id || '';

const TRIGGER_CLASS =
	'px-4 py-3 t-b-2 uppercase whitespace-nowrap border border-foreground/20 -ml-px first:ml-0 transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:hover:bg-foreground data-[state=inactive]:hover:text-background';

export function SizeGuideSection({
	section,
}: {
	section: SizeGuideSectionData;
}) {
	const t = useTranslations('sizeGuide');
	const { title, charts } = section;

	// charts[]-> yields null for a reference whose target was unpublished.
	const chartList = (charts ?? []).filter((chart): chart is SizeChart =>
		Boolean(chart)
	);

	const [active, setActive] = useState(() => tabValue(chartList[0] ?? {}));
	const [displayUnit, setDisplayUnit] = useState<SizeUnit>('cm');
	const sectionRef = useRef<HTMLElement>(null);

	const slugs = chartList.map((chart) => chart.slug).filter(Boolean);
	const slugKey = slugs.join('|');

	// Product pages deep-link to /size-guide#<chart slug>. A chart behind an
	// inactive tab isn't in the DOM, so the browser's own anchor jump finds
	// nothing — activate the owning tab first, then scroll. Each section only
	// answers for hashes it owns and no-ops otherwise.
	useEffect(() => {
		const ownSlugs = slugKey ? slugKey.split('|') : [];
		if (!ownSlugs.length) return;

		const syncFromHash = () => {
			const hash = decodeURIComponent(window.location.hash.slice(1));
			if (!hash || !ownSlugs.includes(hash)) return;
			setActive(hash);
			// The wrapper is always mounted, unlike the panel Radix is about to
			// mount, so scrolling it carries no race.
			sectionRef.current?.scrollIntoView();
		};

		syncFromHash();
		window.addEventListener('hashchange', syncFromHash);
		return () => window.removeEventListener('hashchange', syncFromHash);
	}, [slugKey]);

	if (!chartList.length) return null;

	return (
		<section ref={sectionRef} className="scroll-mt-28">
			{title && <h2 className="t-h-3 uppercase">{title}</h2>}

			<Tabs value={active} onValueChange={setActive} className="mt-5">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<TabsList className="-mx-1 overflow-x-auto px-1">
						{chartList.map((chart) => (
							<TabsTrigger
								key={tabValue(chart)}
								value={tabValue(chart)}
								className={TRIGGER_CLASS}
							>
								{chart.title}
							</TabsTrigger>
						))}
					</TabsList>

					<div className="flex" role="group" aria-label={t.unitToggleAria}>
						{SIZE_UNITS.map((unit) => (
							<button
								key={unit}
								type="button"
								aria-pressed={displayUnit === unit}
								onClick={() => setDisplayUnit(unit)}
								className={cn(
									'px-4 py-3 t-b-2 uppercase whitespace-nowrap border border-foreground/20 -ml-px first:ml-0 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground',
									displayUnit === unit
										? 'bg-foreground text-background'
										: 'hover:bg-foreground hover:text-background'
								)}
							>
								{t.units[unit]}
							</button>
						))}
					</div>
				</div>

				{chartList.map((chart) => (
					<TabsContent
						key={tabValue(chart)}
						value={tabValue(chart)}
						id={chart.slug ?? undefined}
						className="mt-6"
					>
						<SizeChartTable chart={chart} displayUnit={displayUnit} />
					</TabsContent>
				))}
			</Tabs>
		</section>
	);
}
