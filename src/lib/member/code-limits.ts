import 'server-only';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type MemberDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Better Auth limits code requests per IP per minute only. Three more limits
 * sit in front of it, because an attacker can otherwise:
 *
 * - bomb one inbox, replacing the member's code faster than they can type it
 *   -- hence PER EMAIL;
 * - spend the SMTP account's daily cap on random addresses, which also stops
 *   the contact and product-submission forms from sending -- hence TOTAL,
 *   kept below a personal Gmail's ~500/day so those forms keep headroom; and
 * - reach that total from ONE address, since 3/min is 4,320/day -- hence
 *   PER IP per day, checked before the total so a single IP's flood never
 *   counts against it.
 */
export const CODE_LIMITS = {
	perEmail: { max: 5, windowSeconds: 60 * 60 },
	perIp: { max: 20, windowSeconds: 60 * 60 * 24 },
	total: { max: 300, windowSeconds: 60 * 60 * 24 },
};

export type CodeLimits = typeof CODE_LIMITS;

/**
 * Counts one request against `key` and returns whether it is within `max` for
 * the current window. One statement, so two concurrent requests cannot both
 * read the old count -- neon-http has no interactive transactions. A refused
 * request still counts, which keeps a flood refused rather than reset.
 */
async function consume(
	db: MemberDb,
	key: string,
	{ max, windowSeconds }: { max: number; windowSeconds: number }
) {
	const expired = sql`${schema.signInCodeLimit.windowStart} < now() - make_interval(secs => ${windowSeconds})`;
	const [row] = await db
		.insert(schema.signInCodeLimit)
		.values({ key, count: 1, windowStart: sql`now()` })
		.onConflictDoUpdate({
			target: schema.signInCodeLimit.key,
			set: {
				count: sql`case when ${expired} then 1 else ${schema.signInCodeLimit.count} + 1 end`,
				windowStart: sql`case when ${expired} then now() else ${schema.signInCodeLimit.windowStart} end`,
			},
		})
		.returning({ count: schema.signInCodeLimit.count });
	return row.count <= max;
}

/**
 * Drops rows whose window has passed, which would reset on their next request
 * anyway. Without it every address ever tried keeps a row forever. Measured
 * against the longest window, so no live count is lost.
 */
async function prune(db: MemberDb, limits: CodeLimits) {
	const longest = Math.max(
		...Object.values(limits).map((l) => l.windowSeconds)
	);
	await db
		.delete(schema.signInCodeLimit)
		.where(
			sql`${schema.signInCodeLimit.windowStart} < now() - make_interval(secs => ${longest})`
		);
}

/**
 * Whether a code may be sent to `email` from `ip` now. `email` must already be
 * a valid address: an invalid one is refused by the endpoint and must not
 * count. Checked per address first, so a flood aimed at one inbox never
 * touches the other counts, then per IP, so one sender never reaches the
 * site-wide count. A `null` ip (none could be trusted) skips the per-IP
 * check rather than putting every such visitor in one bucket.
 */
export async function mayRequestCode(
	db: MemberDb,
	email: string,
	ip: string | null,
	limits: CodeLimits = CODE_LIMITS
) {
	await prune(db, limits);
	// Lowercased exactly as the endpoint does, so the key is its address.
	const address = email.toLowerCase();
	return (
		(await consume(db, `email:${address}`, limits.perEmail)) &&
		(ip === null || (await consume(db, `ip:${ip}`, limits.perIp))) &&
		(await consume(db, 'total', limits.total))
	);
}
