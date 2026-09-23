/**
 * Luma publishes an event under the short `lu.ma` it hands out for sharing and
 * under `luma.com`, which `lu.ma` links redirect to with the same path.
 * Matched exactly -- a suffix or substring test would accept
 * `lu.ma.example.com` and `notluma.com`.
 */
const LUMA_HOSTS = new Set(['lu.ma', 'luma.com', 'www.luma.com']);

/**
 * `pEvent.lumaUrl` in its one canonical spelling, or `null` when it cannot
 * identify a Luma event.
 *
 * That field is a JOIN KEY, not a link anyone clicks, and editors paste it in
 * whatever form their browser shows: `lu.ma` or `luma.com`, with or without
 * `www`, tracking parameters or a trailing slash. Stored as typed, so COMPARE
 * values only through this function -- two spellings of one event must meet.
 *
 * The host-side manage URL is refused rather than normalised: it names the
 * event by its internal `evt-` id, a different identifier from the public
 * path, so no rewrite can make the two agree. The Studio says to paste the
 * public link instead.
 */
export function normalizeLumaEventUrl(value: string): string | null {
	if (!URL.canParse(value)) return null;
	const url = new URL(value);
	if (url.protocol !== 'https:' || !LUMA_HOSTS.has(url.hostname)) return null;
	const path = url.pathname.replace(/\/+$/, '');
	if (!path || path.startsWith('/event/manage/')) return null;
	return `https://luma.com${path}`;
}
