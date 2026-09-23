/**
 * Luma publishes an event under two hosts: the short `lu.ma` it hands out for
 * sharing, and `luma.com`. Matched exactly -- a suffix or substring test would
 * accept `lu.ma.example.com` and `notluma.com`.
 */
const LUMA_HOSTS = new Set(['lu.ma', 'luma.com', 'www.luma.com']);

/**
 * Whether `value` could identify a Luma event, for `pEvent.lumaUrl`.
 *
 * That field is a JOIN KEY, not a link anyone clicks: it is what lets a Luma
 * guest export be matched to the Sanity event it belongs to, since the export
 * itself names no event. So this is stricter than "is this a URL" -- it must be
 * Luma, and it must point somewhere past the homepage. It cannot tell an event
 * page from a calendar page by shape alone, and does not try.
 */
export function isLumaEventUrl(value: string): boolean {
	if (!URL.canParse(value)) return false;
	const url = new URL(value);
	return (
		url.protocol === 'https:' &&
		LUMA_HOSTS.has(url.hostname) &&
		url.pathname.length > 1
	);
}
