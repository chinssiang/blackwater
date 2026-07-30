/**
 * Preset measurement vocabulary for garment size charts.
 *
 * The key list is the single source of truth, shared by the Sanity schema
 * (gSizeChart builds its column dropdown and per-row number fields from it) and
 * the frontend (SizeChartTable renders columns in this order). Adding a
 * measurement means adding a key here plus its localized label in
 * src/dictionaries/*.json — nothing else.
 *
 * Studio titles are editor-facing chrome and stay English, like every other
 * schema in this project. User-facing labels live in the dictionaries.
 */

export const SIZE_MEASUREMENT_KEYS = [
	'bodyLength',
	'chestWidth',
	'shoulderWidth',
	'sleeveLength',
	'waist',
	'hip',
	'inseam',
] as const;

export type MeasurementKey = (typeof SIZE_MEASUREMENT_KEYS)[number];

/** Editor-facing titles for the Studio column picker and row inputs. */
export const SIZE_MEASUREMENT_STUDIO_TITLES: Record<MeasurementKey, string> = {
	bodyLength: 'Body Length',
	chestWidth: 'Chest Width',
	shoulderWidth: 'Shoulder Width',
	sleeveLength: 'Sleeve Length',
	waist: 'Waist',
	hip: 'Hip',
	inseam: 'Inseam',
};

/** `options.list` for the gSizeChart `columns` field. */
export const SIZE_MEASUREMENT_OPTIONS = SIZE_MEASUREMENT_KEYS.map((key) => ({
	title: SIZE_MEASUREMENT_STUDIO_TITLES[key],
	value: key,
}));

export function isMeasurementKey(value: unknown): value is MeasurementKey {
	return (
		typeof value === 'string' &&
		(SIZE_MEASUREMENT_KEYS as readonly string[]).includes(value)
	);
}

/**
 * Narrows an authored `columns` array to known keys, in the order the editor
 * chose. Guards the frontend against keys left over from a removed measurement.
 */
export function resolveColumns(columns: unknown): MeasurementKey[] {
	if (!Array.isArray(columns)) return [];
	return columns.filter(isMeasurementKey);
}

export const SIZE_UNITS = ['cm', 'in'] as const;

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
