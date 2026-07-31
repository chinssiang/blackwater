'use client';

import { useEffect, useId, useRef, useState } from 'react';
import SizeChartTable, { type SizeChart } from '@/components/SizeChartTable';
import { useTranslations } from '@/components/LocaleProvider';
import { Label } from '@/components/ui/Label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { interpolate } from '@/lib/dictionary';
import { SIZE_UNITS, type SizeUnit } from '@/lib/size-measurements';
import { cn } from '@/lib/utils';

/** One tab. `value` doubles as the DOM id a product page deep-links to. */
export type SizeGuideTabData = {
	value: string;
	/** Short label shown on the pill — the section's override, or the chart title. */
	label: string;
	/** Full chart title, shown in the sidebar. */
	title: string;
	chart: SizeChart;
};

export type SizeGuideSectionData = {
	id: string;
	title: string;
	tabs: SizeGuideTabData[];
};

// A malformed hash ("#50%off" from a mistyped link) makes decodeURIComponent
// throw a URIError, which would crash the route out of the mount effect below.
// Fall back to the raw string — it simply matches no tab value.
const safeDecodeHash = (hash: string) => {
	try {
		return decodeURIComponent(hash);
	} catch {
		return hash;
	}
};

const TRIGGER_CLASS =
	'rounded-full border border-foreground px-3.5 py-1.5 t-l-1 uppercase whitespace-nowrap transition-colors data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:bg-transparent data-[state=inactive]:hover:bg-foreground/5';

export function SizeGuideSection({
	section,
	displayUnit,
	onUnitChange,
}: {
	section: SizeGuideSectionData;
	displayUnit: SizeUnit;
	onUnitChange: (unit: SizeUnit) => void;
}) {
	const t = useTranslations('sizeGuide');
	const { id, title, tabs } = section;

	const [active, setActive] = useState(tabs[0].value);
	const sectionRef = useRef<HTMLElement>(null);
	const unitId = useId();

	// A live edit in Presentation can remove or re-slug the active chart; a
	// controlled Tabs pointing at a vanished value renders pills with no panel.
	// Reset during render (React's adjust-state-on-prop-change pattern).
	if (!tabs.some((tab) => tab.value === active)) {
		setActive(tabs[0].value);
	}

	const tabKey = tabs.map((tab) => tab.value).join('|');

	// Product pages deep-link to /size-guide#<chart slug>, and the sidebar links
	// the same way. A chart behind an inactive tab isn't in the DOM, so the
	// browser's own anchor jump finds nothing — activate the owning tab first,
	// then scroll. Each section only answers for values it owns.
	useEffect(() => {
		const ownValues = tabKey ? tabKey.split('|') : [];
		if (!ownValues.length) return;

		const syncFromHash = () => {
			const hash = safeDecodeHash(window.location.hash.slice(1));
			if (!hash || !ownValues.includes(hash)) return;
			setActive(hash);
			// The wrapper is always mounted, unlike the panel Radix is about to
			// mount, so scrolling it carries no race.
			sectionRef.current?.scrollIntoView();
		};

		syncFromHash();
		window.addEventListener('hashchange', syncFromHash);
		return () => window.removeEventListener('hashchange', syncFromHash);
	}, [tabKey]);

	return (
		// Scroll margin clears the sticky stack (header + optional announcement +
		// mobile nav strip), derived from the same vars the stack is built from
		// rather than a hardcoded pixel count. 3.75rem covers the strip + breathing.
		<section
			ref={sectionRef}
			id={id}
			className="scroll-mt-[calc(var(--h-header)+var(--h-announcement,0px)+3.75rem)]"
		>
			<div className="flex items-center justify-between gap-4">
				{title && <h2 className="t-l-1 uppercase">{title}</h2>}

				{/* One control per section, as drawn, but they all write the same page
				    level state — toggling one converts every table. */}
				<RadioGroup
					value={displayUnit}
					onValueChange={(value) => onUnitChange(value as SizeUnit)}
					aria-label={interpolate(t.unitToggleAria, { section: title })}
					className="flex shrink-0 items-center gap-2"
				>
					{SIZE_UNITS.map((unit) => (
						<div key={unit} className="flex items-center gap-1">
							<RadioGroupItem
								id={`${unitId}-${unit}`}
								value={unit}
								className="border-foreground size-3.5 shadow-none dark:bg-transparent"
							/>
							<Label
								htmlFor={`${unitId}-${unit}`}
								className="t-l-2 cursor-pointer uppercase"
							>
								{t.units[unit]}
							</Label>
						</div>
					))}
				</RadioGroup>
			</div>

			<Tabs value={active} onValueChange={setActive} className="mt-5">
				<TabsList className="scrollbar-none -mx-1 gap-1 overflow-x-auto px-1">
					{tabs.map((tab) => (
						<TabsTrigger
							key={tab.value}
							value={tab.value}
							className={TRIGGER_CLASS}
						>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>

				{/* The slug id lives on this always-mounted wrapper, NOT on
				    TabsContent: Radix unmounts inactive panels entirely (so their ids
				    would vanish from the DOM), and a custom id on TabsContent would
				    replace the generated one every trigger's aria-controls points at. */}
				{tabs.map((tab) => (
					<div key={tab.value} id={tab.value}>
						<TabsContent value={tab.value} className="mt-5">
							<SizeChartTable chart={tab.chart} displayUnit={displayUnit} />
						</TabsContent>
					</div>
				))}
			</Tabs>
		</section>
	);
}
