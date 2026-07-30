'use client';

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/Table';
import { stegaClean } from '@sanity/client/stega';
import { useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';
import { resolveColumns, type MeasurementKey } from '@/lib/size-measurements';
import { cn, hasArrayValue } from '@/lib/utils';

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

const ROW_CLASS = 'border-b border-foreground/10';
// The mock shows a hairline under every row including the last. TableBody's
// default `[&_tr:last-child]:border-0` is a descendant rule on the tbody, so it
// beats `border-b` on the tr on specificity and cn() can't merge across
// elements — it has to be countered on the tbody itself. See TABLE_BODY_CLASS.
const TABLE_BODY_CLASS = '[&_tr:last-child]:border-b';
const CELL_BASE = 'px-0 pr-6 last:pr-0 py-3.5 lg:py-4';
// TableCell ships a `group-hover:text-background` invert. Neutralised on body
// cells only — TableHead has no invert, so applying it there would be dead.
const NO_INVERT = 'group-hover:text-foreground';

/**
 * Whether a chart has enough authored data to render a table. Exported so the
 * page can gate its empty state on the same condition this component bails on,
 * instead of on how many documents were fetched.
 *
 * stegaClean is required, not defensive: in draft mode Sanity encodes invisible
 * metadata into strings, and for an array of primitives the source path ends in
 * a numeric index — so @sanity/client's denylist never fires on `columns[n]`.
 * Without it every key fails the SIZE_MEASUREMENT_KEYS comparison and every
 * chart renders as nothing inside the Presentation tool.
 */
export function isRenderable(chart: SizeChart): boolean {
	return (
		resolveColumns(stegaClean(chart.columns)).length > 0 &&
		hasArrayValue(chart.rows)
	);
}

export default function SizeChartTable({
	chart,
	className,
}: {
	chart: SizeChart;
	className?: string;
}) {
	const t = useTranslations('sizeGuide');
	const { title, slug, unit, columns, rows, note } = chart;

	// The second check duplicates isRenderable's, but narrows `rows` for TypeScript.
	if (!isRenderable(chart) || !hasArrayValue(rows)) return null;

	const activeColumns = resolveColumns(stegaClean(columns));
	const resolvedUnit = stegaClean(unit) || 'cm';

	return (
		<section id={slug ?? undefined} className={cn('scroll-mt-28', className)}>
			{title && <h2 className="t-h-3 uppercase">{title}</h2>}

			<Table className="mt-5">
				<TableHeader>
					{/* TableHeader already supplies the header hairline via [&_tr]:border-b */}
					<TableRow>
						<TableHead className={cn(CELL_BASE, 't-l-1 h-auto uppercase')}>
							{t.sizeColumn}
						</TableHead>
						{activeColumns.map((key) => (
							<TableHead
								key={key}
								className={cn(CELL_BASE, 't-l-1 h-auto uppercase')}
							>
								{t.measurements[key]}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody className={TABLE_BODY_CLASS}>
					{rows.map((row, index) => (
						<TableRow
							key={row._key ?? `${row.size}-${index}`}
							className={ROW_CLASS}
						>
							<TableCell
								className={cn(CELL_BASE, 't-b-1 uppercase', NO_INVERT)}
							>
								{row.size}
							</TableCell>
							{activeColumns.map((key) => {
								const value = row[key];
								return (
									<TableCell
										key={key}
										className={cn(CELL_BASE, 't-spec', NO_INVERT)}
									>
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
