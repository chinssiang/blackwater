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
import {
	formatMeasurement,
	resolveColumns,
	resolveUnit,
	type MeasurementKey,
	type SizeUnit,
} from '@/lib/size-measurements';
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
const CELL_BASE =
	'group-hover:text-foreground px-0 pr-6 last:pr-0 py-3.5 lg:py-4';

export default function SizeChartTable({
	chart,
	displayUnit,
	className,
}: {
	chart: SizeChart;
	/** Unit to read the table in. Defaults to the unit the chart was authored in. */
	displayUnit?: SizeUnit;
	className?: string;
}) {
	const t = useTranslations('sizeGuide');
	const { unit, columns, rows, note } = chart;

	const activeColumns = resolveColumns(columns);
	const chartRows = (rows ?? []).filter(Boolean);

	// Nothing renderable — an unfinished chart shouldn't produce an empty table.
	if (!activeColumns.length || !chartRows.length) return null;

	const measurementLabels = t.measurements as Record<string, string>;
	// Read per chart, so a section may mix a cm-authored and an in-authored chart.
	const authoredUnit = resolveUnit(unit);
	const shownUnit = displayUnit ?? authoredUnit;

	return (
		<div className={className}>
			<Table>
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
						<TableRow
							key={row._key ?? `${row.size}-${index}`}
							className={ROW_CLASS}
						>
							<TableCell className={cn(CELL_BASE, 't-b-1 uppercase')}>
								{row.size}
							</TableCell>
							{activeColumns.map((key) => {
								const value = row[key];
								return (
									<TableCell key={key} className={cn(CELL_BASE, 't-spec')}>
										{typeof value === 'number'
											? formatMeasurement(value, authoredUnit, shownUnit)
											: '—'}
									</TableCell>
								);
							})}
						</TableRow>
					))}
				</TableBody>
			</Table>

			{note && (
				<p className="t-b-2 text-muted-foreground mt-4 whitespace-pre-line">
					{note}
				</p>
			)}
		</div>
	);
}
