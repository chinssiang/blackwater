import { stegaClean } from '@sanity/client/stega';
import type { Dictionary } from './dictionary';

/**
 * `pEvent.dateStatus` resolved for display: whether the date is real, and what
 * to show when it is not. /events, the event page and the home-page strip all
 * render this one field, and each had hand-rolled its own answer.
 *
 * A LEAF MODULE on purpose, and NOT part of `dictionary.ts`: that one is
 * imported for values by fifteen client components including the cart chrome,
 * and `@sanity/client/stega` is not a leaf -- its entry does
 * `export * from "@sanity/client"`. The `Dictionary` import above is type-only,
 * so no runtime edge goes back the other way.
 *
 * `stegaClean` once, here, rather than at each call site: an uncleaned
 * `=== 'confirmed'` is false for EVERY confirmed event in the Presentation tool
 * and the date silently disappears. Returning both answers from one clean is
 * what stops a caller pairing them wrongly.
 *
 * `label` is never the raw enum: `postponed`/`cancelled` would render as
 * English in both locales, and `tba` would beat the translated `t.status.tba`
 * simply by being truthy. `confirmed` reaches the label only when the document
 * carries no date at all, which is a missing date rather than a status, so it
 * falls through to TBA as well.
 */
export function resolveEventDateStatus(
	dateStatus: string | null | undefined,
	t: Dictionary['events']
): { isFirm: boolean; label: string } {
	const status = stegaClean(dateStatus);
	return {
		isFirm: !status || status === 'confirmed',
		label:
			status === 'postponed' || status === 'cancelled'
				? t.status[status]
				: t.status.tba,
	};
}
