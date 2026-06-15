import { at, defineMigration, set } from 'sanity/migrate';
import type { NodePatch } from 'sanity/migrate';
import { formatInTimeZone, getTimezoneOffset } from 'date-fns-tz';

/*
	Converts the legacy `datetime` string values on pEvent.eventDatetime /
	pEvent.endDatetime into the object shape produced by `@sanity/rich-date-input`
	({ _type, utc, local, timezone, offset }).

	The original `datetime` values are UTC instants with no recorded timezone.
	We assume they were entered as Asia/Taipei (UTC+8) wall-clock times, which is
	the timezone reconstructed into `local`.

	Run order (against the dataset that holds live event data — production):
	  1. Deploy the schema change (p-event.ts uses type: 'richDate').
	  2. Dry-run:  npx sanity migration run datetime-to-rich-date --dataset <prod>
	  3. Apply:    npx sanity migration run datetime-to-rich-date --dataset <prod> --no-dry-run
	  4. Validate: npx sanity documents validate -y --dataset <prod>
*/

const ASSUMED_TIMEZONE = 'Asia/Taipei';

const DATETIME_FIELDS = ['eventDatetime', 'endDatetime'] as const;

function toRichDate(utc: string) {
	return {
		_type: 'richDate' as const,
		utc,
		local: formatInTimeZone(utc, ASSUMED_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX"),
		timezone: ASSUMED_TIMEZONE,
		// date-fns-tz returns the offset in milliseconds; the plugin stores minutes.
		offset: getTimezoneOffset(ASSUMED_TIMEZONE, new Date(utc)) / 60_000,
	};
}

export default defineMigration({
	title: 'Convert pEvent datetime fields to richDate objects',
	documentTypes: ['pEvent'],
	migrate: {
		document(doc): NodePatch[] | undefined {
			const patches: NodePatch[] = [];
			for (const field of DATETIME_FIELDS) {
				const value = (doc as Record<string, unknown>)[field];
				// Only migrate untouched legacy strings; skip already-converted objects.
				if (typeof value === 'string' && value) {
					patches.push(at(field, set(toRichDate(value))));
				}
			}
			return patches.length > 0 ? patches : undefined;
		},
	},
});
