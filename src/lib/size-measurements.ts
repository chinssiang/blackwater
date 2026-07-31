/**
 * Unit handling and number formatting for garment size charts.
 *
 * Measurement labels and sizes are authored per chart on gSizeChart (labels via
 * internationalizedArrayString), so there is no preset vocabulary here — adding
 * a measurement is content work, not a code change.
 */

/** Also the order the unit control renders in — inches first, per the design. */
export const SIZE_UNITS = ['in', 'cm'] as const;

export type SizeUnit = (typeof SIZE_UNITS)[number];

/** `options.list` for the gSizeChart `unit` field. */
export const SIZE_UNIT_OPTIONS = [
	{ title: 'Centimetres (cm)', value: 'cm' },
	{ title: 'Inches (in)', value: 'in' },
];

/**
 * Narrows an authored unit to a known value. Charts are entered in one unit and
 * the page converts to the other, so an unrecognised value falling back to cm
 * matches the schema's initialValue.
 */
export function resolveUnit(value: unknown): SizeUnit {
	return value === 'in' ? 'in' : 'cm';
}

const CM_PER_INCH = 2.54;

/**
 * Formats a measurement for display. A value shown in the unit it was authored
 * in passes through untouched (71 → "71"); a converted value is fixed to one
 * decimal so the column stays aligned (71cm → "28.0").
 */
export function formatMeasurement(
	value: number,
	from: SizeUnit,
	to: SizeUnit
): string {
	if (from === to) return String(value);
	const converted = to === 'in' ? value / CM_PER_INCH : value * CM_PER_INCH;
	return converted.toFixed(1);
}

/** En dash, as the design uses for ranges — not a hyphen. */
const EN_DASH = '–';

/**
 * Formats one cell. `max` is optional on purpose: a chart mixes fit ranges
 * ("34–36") with single garment measurements ("32") in the same table, and both
 * ends stay numeric so the cm/in toggle can still convert them.
 */
export function formatRange(
	min: number,
	max: number | null | undefined,
	from: SizeUnit,
	to: SizeUnit
): string {
	const low = formatMeasurement(min, from, to);
	if (typeof max !== 'number' || max === min) return low;
	return `${low}${EN_DASH}${formatMeasurement(max, from, to)}`;
}
