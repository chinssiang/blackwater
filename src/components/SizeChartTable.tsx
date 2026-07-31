'use client';

import { useMemo } from 'react';
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
import {
	formatRange,
	resolveUnit,
	type SizeUnit,
} from '@/lib/size-measurements';
import { cn, hasArrayValue } from '@/lib/utils';

export type SizeChartValue = {
	_key?: string | null;
	/** Names the column this cell belongs to. Matched against `SizeChart.sizes`. */
	size?: string | null;
	min?: number | null;
	max?: number | null;
};

/** One rendered row: a measurement label plus one value per size, in any order. */
export type SizeChartMeasurement = {
	_key?: string | null;
	label?: string | null;
	values?: (SizeChartValue | null)[] | null;
};

export type SizeChart = {
	_id?: string | null;
	title?: string | null;
	slug?: string | null;
	unit?: string | null;
	sizes?: (string | null)[] | null;
	rows?: (SizeChartMeasurement | null)[] | null;
	note?: string | null;
};

// border-separate rather than the default collapse: under collapse the *table*
// owns the borders, not the cells, so they do not travel with the sticky label
// column and bleed across it while the values scroll underneath. Separate
// borders belong to the cells. The table draws the top and left edges and every
// cell draws its own bottom and right, which gives a uniform 1px grid with no
// doubling. (border-spacing-0 keeps it flush.) A side effect worth knowing: <tr>
// borders are ignored entirely in separate mode, so TableHeader's own
// `[&_tr]:border-b` goes quiet on its own and needs no countering.
const TABLE_CLASS =
	'table-fixed border-separate border-spacing-0 border-t border-l border-foreground/10';
// table-fixed ignores content widths, so without a floor a wide chart squashes
// its columns instead of overflowing into the scroll container. Derived from the
// column count rather than a flat value: a fixed 640px would force a one-size
// accessories chart to scroll sideways to reveal its single measurement.
const LABEL_COLUMN_WIDTH = 120;
const MIN_SIZE_COLUMN_WIDTH = 96;
const CELL_BORDER = 'border-r border-b border-foreground/10';
// An opaque mix rather than `bg-muted` or `bg-foreground/5`: the dark theme's
// --muted is a mid grey that reads as a heavy band against the near-black page,
// and a translucent tint would let scrolled values slide visibly under the
// sticky corner cell. Mixing against the background keeps the mock's subtle lift
// in both themes while staying opaque.
const HEAD_FILL =
	'bg-[color-mix(in_oklab,var(--color-foreground)_5%,var(--color-background))]';
const HEAD_CLASS = `h-[30px] px-3 py-0 t-l-2 ${HEAD_FILL} uppercase text-center`;
// Sizes can outgrow a phone, so the label column pins while the values scroll.
// Keep the width in step with LABEL_COLUMN_WIDTH above.
const STICKY_LABEL = 'sticky left-0 w-[120px] text-left';
const ROW_LABEL_CLASS = 'h-[34px] px-3 py-0 t-l-2 bg-background uppercase';
// `lg:py-0` is load-bearing: TableCell's base is `py-4 lg:py-6`, and twMerge
// only drops `py-4` for a same-variant `py-0` — the lg override would survive
// and stretch the row past 34px. The `group-hover:text-foreground` neutralises
// TableCell's `group-hover:text-background` invert, which would otherwise hide
// the text on row hover; TableHead has no invert, so it isn't needed there.
const VALUE_CLASS =
	'h-[34px] px-3 py-0 lg:py-0 t-l-1 text-center group-hover:text-foreground';

/**
 * Whether a chart has enough authored data to render a table. Exported so the
 * page can gate its empty state on the same condition this component bails on,
 * instead of on how many documents were fetched.
 *
 * `some(Boolean)` rather than a length check on `sizes`: drafts render
 * unvalidated, and a just-added, still-empty size entry (`sizes: ['']`) must
 * not earn a tab whose panel the component below then refuses to render.
 */
export function isRenderable(chart: SizeChart): boolean {
	return (chart.sizes ?? []).some(Boolean) && hasArrayValue(chart.rows);
}

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
	const { unit, sizes, rows, note } = chart;

	// Cells are matched by size, never by position, so reordering or inserting a
	// size in the Studio cannot shift a row's numbers under the wrong heading.
	// Memoized on `rows` (house style — see PageEvents): the shared unit toggle
	// re-renders every table on the page, and this only depends on the rows.
	// Runs before the early returns below — hooks must be unconditional.
	const cellsBySize = useMemo(
		() =>
			(rows ?? []).map(
				(row) =>
					new Map(
						(row?.values ?? []).flatMap((value) => {
							const key = stegaClean(value?.size);
							return value && key ? ([[key, value]] as const) : [];
						})
					)
			),
		[rows]
	);

	// Narrowed once, so a blank entry can't render an unlabelled phantom column,
	// and memoized on `sizes` for the same reason as cellsBySize above.
	// stegaClean is required wherever a value is *compared* rather than rendered,
	// and draft mode is exactly where that bites: Sanity encodes invisible metadata
	// into strings, and for an array of primitives the source path ends in a
	// numeric index, so @sanity/client's denylist never fires on `sizes[n]`. The
	// cleaned copy is what each cell's `size` is matched against (cleaned once per
	// column, not per cell); the raw copy renders the headings, whose encoding is
	// what powers click-to-edit in Presentation.
	const { sizeColumns, cleanSizes } = useMemo(() => {
		const columns = (sizes ?? []).filter((size): size is string =>
			Boolean(size)
		);
		return {
			sizeColumns: columns,
			cleanSizes: columns.map((size) => stegaClean(size)),
		};
	}, [sizes]);

	// The second check duplicates isRenderable's, but narrows `rows` for TypeScript.
	if (!isRenderable(chart) || !hasArrayValue(rows)) return null;
	if (!sizeColumns.length) return null;

	// resolveUnit compares against 'in', so the unit is cleaned too.
	const authoredUnit = resolveUnit(stegaClean(unit));
	const shownUnit = displayUnit ?? authoredUnit;

	return (
		<div className={className}>
			{note && (
				<p className="t-b-2 text-muted-foreground mb-4 whitespace-pre-line">
					{note}
				</p>
			)}

			<Table
				className={TABLE_CLASS}
				style={{
					minWidth:
						LABEL_COLUMN_WIDTH + sizeColumns.length * MIN_SIZE_COLUMN_WIDTH,
				}}
			>
				<TableHeader>
					<TableRow>
						<TableHead
							className={cn(HEAD_CLASS, CELL_BORDER, STICKY_LABEL, 'z-2')}
						>
							{/* A one-size chart lists measurements against a single column, so
							    "Size" would be a misleading corner label. */}
							{sizeColumns.length === 1 ? t.measurementColumn : t.sizeColumn}
						</TableHead>
						{sizeColumns.map((size, index) => (
							<TableHead
								key={`${size}-${index}`}
								className={cn(HEAD_CLASS, CELL_BORDER)}
							>
								{size}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row, rowIndex) => (
						<TableRow key={row?._key ?? rowIndex}>
							<TableHead
								scope="row"
								className={cn(
									ROW_LABEL_CLASS,
									CELL_BORDER,
									STICKY_LABEL,
									'z-1'
								)}
							>
								{row?.label}
							</TableHead>
							{sizeColumns.map((size, sizeIndex) => {
								// The schema blocks publishing a chart whose measurements
								// don't cover every size, but an API-written one can still
								// have a gap — those render as an em dash.
								const value = cellsBySize[rowIndex].get(cleanSizes[sizeIndex]);
								return (
									<TableCell
										key={`${size}-${sizeIndex}`}
										className={cn(VALUE_CLASS, CELL_BORDER)}
									>
										{typeof value?.min === 'number'
											? formatRange(
													value.min,
													value.max,
													authoredUnit,
													shownUnit
												)
											: '—'}
									</TableCell>
								);
							})}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
