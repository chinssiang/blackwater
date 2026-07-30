'use client';

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/Table';
import { useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';
import { resolveColumns, type MeasurementKey } from '@/lib/size-measurements';
import { cn } from '@/lib/utils';

// Measurement fields are derived from the vocabulary so the row type can never
// drift from SIZE_MEASUREMENT_KEYS.
export type SizeChartRow = {
	_key?: string | null;
	size?: string | null;
} & Partial<Record<MeasurementKey, number | null>>;

export type SizeChart = {
	_id?: string | null;
	title?: string | null;
	slug?: string | null;
	unit?: string | null;
	columns?: string[] | null;
	rows?: SizeChartRow[] | null;
	note?: string | null;
};

// The mock shows a hairline under every row including the last, so TableBody's
// default `[&_tr:last-child]:border-0` is overridden here.
const ROW_CLASS = 'border-b border-border';
// TableRow/TableCell ship a `group` + `group-hover:text-background` invert used
// by the events table. Neutralised here — a size chart is static data, not a
// list of links.
const CELL_BASE = 'group-hover:text-foreground px-0 pr-6 last:pr-0 py-3.5 lg:py-4';

export default function SizeChartTable({
	chart,
	className,
}: {
	chart: SizeChart;
	className?: string;
}) {
	const t = useTranslations('sizeGuide');
	const { title, slug, unit, columns, rows, note } = chart;

	const activeColumns = resolveColumns(columns);
	const chartRows = (rows ?? []).filter(Boolean);

	// Nothing renderable — an unfinished chart shouldn't produce an empty table.
	if (!activeColumns.length || !chartRows.length) return null;

	const measurementLabels = t.measurements as Record<string, string>;
	const resolvedUnit = unit || 'cm';

	return (
		<section id={slug ?? undefined} className={cn('scroll-mt-28', className)}>
			{title && <h2 className="t-h-3 uppercase">{title}</h2>}

			<Table className="mt-5">
				<TableHeader>
					<TableRow className={ROW_CLASS}>
						<TableHead className={cn(CELL_BASE, 't-l-1 h-auto uppercase')}>
							{t.sizeColumn}
						</TableHead>
						{activeColumns.map((key) => (
							<TableHead
								key={key}
								className={cn(CELL_BASE, 't-l-1 h-auto uppercase')}
							>
								{measurementLabels[key] ?? key}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{chartRows.map((row, index) => (
						<TableRow key={row._key ?? `${row.size}-${index}`} className={ROW_CLASS}>
							<TableCell className={cn(CELL_BASE, 't-b-1 uppercase')}>
								{row.size}
							</TableCell>
							{activeColumns.map((key) => {
								const value = row[key];
								return (
									<TableCell key={key} className={cn(CELL_BASE, 't-spec')}>
										{typeof value === 'number' ? value : '—'}
									</TableCell>
								);
							})}
						</TableRow>
					))}
				</TableBody>
			</Table>

			<div className="t-b-2 text-muted-foreground mt-4 space-y-1">
				<p>{interpolate(t.unitNote, { unit: resolvedUnit })}</p>
				{note && <p className="whitespace-pre-line">{note}</p>}
			</div>
		</section>
	);
}
