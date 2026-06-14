import { formatInTimeZone } from 'date-fns-tz';
import type { Locale } from 'date-fns';
import type { RichDate } from 'sanity.types';

const FALLBACK_TIMEZONE = 'Asia/Taipei';

/**
 * Format a `richDate` value in its own stored timezone, so the editor's
 * intended wall-clock time is shown regardless of the runtime timezone.
 * Returns an empty string when the value has no usable instant.
 */
export function formatRichDate(
	value: RichDate | null | undefined,
	formatStr: string,
	locale?: Locale
): string {
	if (!value?.utc) return '';
	const timezone = value.timezone || FALLBACK_TIMEZONE;
	return formatInTimeZone(
		value.utc,
		timezone,
		formatStr,
		locale ? { locale } : undefined
	);
}

/**
 * The absolute instant of a `richDate` as a `Date` (built from its UTC value).
 * Use for comparisons and ordering — not for display (use `formatRichDate`).
 */
export function getRichDateInstant(
	value: RichDate | null | undefined
): Date | null {
	if (!value?.utc) return null;
	const date = new Date(value.utc);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The year/month of a `richDate` evaluated in its stored timezone, so events
 * near midnight are grouped into the correct local month. Returns `YYYY` and a
 * 0-based month index, matching `Date.getMonth()`.
 */
export function getRichDateYearMonth(
	value: RichDate | null | undefined
): { year: number; month: number } | null {
	if (!value?.utc) return null;
	const timezone = value.timezone || FALLBACK_TIMEZONE;
	const yyyyMM = formatInTimeZone(value.utc, timezone, 'yyyy-MM');
	const [year, month] = yyyyMM.split('-').map(Number);
	return { year, month: month - 1 };
}
