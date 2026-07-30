/**
 * Preset measurement vocabulary for garment size charts.
 *
 * The key list is the single source of truth, shared by the Sanity schema
 * (gSizeChart builds its column picker and per-row number fields from it) and
 * the frontend (SizeChartTable renders columns in this order).
 *
 * Adding a measurement means: add a key here, add its localized label to
 * `sizeGuide.measurements` in every src/dictionaries/*.json, then run
 * `npm run typegen` — the key also becomes a new field on the sizeChartRow
 * object, so it is a schema change. SizeChartTable indexes the dictionary with
 * MeasurementKey, so a missing en.json label is a compile error.
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

function isMeasurementKey(value: unknown): value is MeasurementKey {
	return (
		typeof value === 'string' &&
		(SIZE_MEASUREMENT_KEYS as readonly string[]).includes(value)
	);
}

/**
 * Narrows an authored `columns` array to known keys and returns them in
 * vocabulary order.
 *
 * Vocabulary order — not authored order — is deliberate: `columns` is an array
 * of strings with `options.list`, which Sanity renders as a checkbox grid whose
 * change handler rebuilds the whole array by mapping over the option list. The
 * stored order is therefore always SIZE_MEASUREMENT_KEYS order regardless of
 * click order, and there are no drag handles to change it. Sorting here makes
 * that the explicit contract instead of an accident, and also dedupes, so a
 * chart written outside the Studio (migration, import, API patch) can't produce
 * duplicate React keys or a repeated column.
 */
export function resolveColumns(columns: unknown): MeasurementKey[] {
	if (!Array.isArray(columns)) return [];
	const authored = new Set(columns.filter(isMeasurementKey));
	return SIZE_MEASUREMENT_KEYS.filter((key) => authored.has(key));
}
