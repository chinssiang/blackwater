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
