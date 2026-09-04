'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { stegaClean } from '@sanity/client/stega';
import SizeChartTable, { type SizeChart } from '@/components/SizeChartTable';
import { useTranslations } from '@/components/LocaleProvider';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/Dialog';
import { Label } from '@/components/ui/Label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { interpolate } from '@/lib/dictionary';
import {
	SIZE_UNITS,
	resolveUnit,
	type SizeUnit,
} from '@/lib/size-measurements';

/**
 * Shared with the fallback link the product page renders when a chart has no
 * table to show, so the two are indistinguishable to a reader.
 */
export const SIZE_GUIDE_LINK_CLASS =
	't-l-1 cursor-pointer uppercase text-foreground/65 underline decoration-foreground/25 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/60';

export default function SizeChartDialog({
	chart,
	sizeGuideHref,
}: {
	/** Must be renderable — the caller decides, and renders a link if it isn't. */
	chart: SizeChart;
	/** Deep link to this chart on the size guide page, for cross-chart browsing. */
	sizeGuideHref: string | null;
}) {
	const productText = useTranslations('products');
	const t = useTranslations('sizeGuide');
	const unitId = useId();
	const titleRef = useRef<HTMLHeadingElement>(null);

	const [displayUnit, setDisplayUnit] = useState<SizeUnit>(() =>
		resolveUnit(stegaClean(chart.unit))
	);

	const chartTitle = chart.title ?? productText.sizeGuide;

	return (
		<Dialog>
			<DialogTrigger asChild>
				<button type="button" className={SIZE_GUIDE_LINK_CLASS}>
					{productText.sizeGuide}
				</button>
			</DialogTrigger>
			{/* Widths: this theme rescales Tailwind's container tokens (--container-md
			    is 900px, not 448px), which comfortably clears a 7-column chart's 792px
			    table. The min() keeps the base gutter — DialogContent's own
			    max-w-[calc(100%-2rem)] stops applying at sm, so a bare token would go
			    edge-to-edge between 640px and 900px.
			    Scrolling is on the table wrapper, not here: the close button is
			    positioned against this element, so if this element scrolled the X
			    would slide off the top.
			    aria-describedby is suppressed because the chart note (rendered inside
			    SizeChartTable) is the description, and Radix would otherwise warn. */}
			<DialogContent
				className="flex max-h-[85svh] flex-col gap-3 rounded-xl p-4 sm:max-w-[min(var(--container-md),calc(100%-2rem))]"
				aria-describedby={undefined}
				// Radix focuses the first tabbable node, which here is the checked
				// unit radio — and radio groups select on arrow keys, so a reader
				// pressing ArrowDown to scroll would silently convert every value.
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					titleRef.current?.focus();
				}}
			>
				<DialogHeader className="pr-8 text-left">
					<DialogTitle
						ref={titleRef}
						tabIndex={-1}
						className="t-h-3 uppercase outline-none"
					>
						{chartTitle}
					</DialogTitle>
				</DialogHeader>

				<RadioGroup
					value={displayUnit}
					onValueChange={(value) => setDisplayUnit(value as SizeUnit)}
					aria-label={interpolate(t.unitToggleAria, { section: chartTitle })}
					className="flex items-center gap-2"
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

				{/* min-h-0 lets this shrink below its content so the scroll lands here
				    rather than overflowing the dialog; min-w-0 keeps the table's own
				    minWidth from widening the dialog instead of scrolling inside it. */}
				<div className="min-h-0 min-w-0 overflow-y-auto">
					<SizeChartTable chart={chart} displayUnit={displayUnit} />
				</div>

				{/* The dialog shows one chart; sizing against a different garment means
				    the full guide. Without this the size guide page has no inbound
				    link from products at all. */}
				{sizeGuideHref && (
					<Link
						href={sizeGuideHref}
						className={`${SIZE_GUIDE_LINK_CLASS} t-l-2 self-start`}
					>
						{productText.viewFullSizeGuide}
					</Link>
				)}
			</DialogContent>
		</Dialog>
	);
}
