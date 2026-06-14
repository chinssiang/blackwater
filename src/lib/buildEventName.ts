import { formatInTimeZone } from 'date-fns-tz';
import { enUS, zhTW } from 'date-fns/locale';
import type { Locale } from '@/lib/i18n';

const FALLBACK_TIMEZONE = 'Asia/Taipei';

const DATE_FNS_LOCALES = { en: enUS, zh_tw: zhTW } as const;

// Concise, locale-aware date used inside structured-data names (no time).
const NAME_DATE_FORMAT: Record<Locale, string> = {
	en: 'MMM d, yyyy',
	zh_tw: 'yyyy年M月d日',
};

export type EventNameParts = {
	title?: string | null;
	subtitle?: string | null;
	location?: string | null;
	/** UTC instant of the event (richDate.utc). */
	eventDatetime?: string | null;
	/** IANA timezone the event date should be rendered in (richDate.timezone). */
	timezone?: string | null;
};

/**
 * Build a human-meaningful event name for structured data. The bare `title`
 * is often just an internal code (e.g. "BW-134-rr"), so we lead with it and
 * append the editor-authored subtitle plus the locale-resolved location and a
 * locale-aware date. Shared by the events ItemList (index) and the Event
 * JSON-LD (detail) so the carousel item and its target page agree.
 *
 * Inputs are expected to be already locale-resolved (pEvent is document-level
 * i18n; locationRef.name is coalesced per locale upstream), so the only
 * locale-dependent formatting here is the date — there is no hardcoded text.
 */
export function buildEventName(parts: EventNameParts, locale: Locale): string {
	const { title, subtitle, location, eventDatetime, timezone } = parts;

	const core = subtitle ? `${title} — ${subtitle}` : title || '';
	const segments = [core];

	if (location) segments.push(location);

	if (eventDatetime) {
		const date = new Date(eventDatetime);
		if (!Number.isNaN(date.getTime())) {
			segments.push(
				formatInTimeZone(
					date,
					timezone || FALLBACK_TIMEZONE,
					NAME_DATE_FORMAT[locale],
					{ locale: DATE_FNS_LOCALES[locale] }
				)
			);
		}
	}

	return segments.filter(Boolean).join(' · ');
}
