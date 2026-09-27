import { stegaClean } from 'next-sanity';
import { getRichDateInstant, resolveEventTimezone } from '@/lib/event-date';
import { normalizeLumaEventUrl } from '@/lib/luma';
import type { AttendanceRow } from '@/lib/member/attendance';
import type { MemberHistoryEventsQueryResult } from 'sanity.types';

export type ClubHistoryEntry = {
	key: string;
	/** '' when neither the site nor Luma named it. */
	title: string;
	/** The site's page for it, or null when it has none in this language. */
	slug: string | null;
	startsAt: Date | null;
	/** The zone to print `startsAt` in: the event's own when the site has it. */
	timeZone: string;
	checkedIn: boolean;
};

/**
 * A member's attendance rows joined to the site's events on the Luma link,
 * newest first. A row with no matching event still appears, under the name and
 * start time Luma gave it -- a member's history is not limited to the events
 * the club made a page for.
 */
export function buildClubHistory(
	rows: AttendanceRow[],
	events: MemberHistoryEventsQueryResult
): ClubHistoryEntry[] {
	const byUrl = new Map<string, MemberHistoryEventsQueryResult[number]>();
	for (const event of events) {
		// Compared, not rendered, so cleaned: draft mode may encode the link.
		const key = normalizeLumaEventUrl(stegaClean(event.lumaUrl));
		if (key && !byUrl.has(key)) byUrl.set(key, event);
	}
	return rows
		.map((row) => {
			const event = byUrl.get(row.lumaEventUrl);
			return {
				key: row.lumaEventUrl,
				title: event?.title || row.eventName,
				slug: event?.slug ?? null,
				startsAt: getRichDateInstant(event?.eventDatetime) ?? row.eventStartsAt,
				timeZone: resolveEventTimezone(event?.eventDatetime?.timezone),
				checkedIn: row.checkedIn,
			};
		})
		.sort(
			(a, b) =>
				(b.startsAt?.getTime() ?? -Infinity) -
				(a.startsAt?.getTime() ?? -Infinity)
		);
}

/**
 * History split at `now` into what is coming up (soonest first) and what is
 * past (newest first). Undated rows count as past: Luma sends a start time
 * with every guest, so a row without one is a backfill of something old.
 */
export function splitClubHistory(
	history: ClubHistoryEntry[],
	now = Date.now()
) {
	const isUpcoming = (e: ClubHistoryEntry) =>
		!!e.startsAt && e.startsAt.getTime() > now;
	return {
		upcoming: history.filter(isUpcoming).reverse(),
		past: history.filter((e) => !isUpcoming(e)),
	};
}
