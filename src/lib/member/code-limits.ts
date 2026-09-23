import 'server-only';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type MemberDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Better Auth limits code requests per IP only. Two more limits sit in front of
 * it, because an attacker rotating IPs can otherwise:
 *
 * - bomb one inbox, replacing the member's code faster than they can type it
 *   -- hence PER EMAIL; and
 * - spend the SMTP account's daily cap on random addresses, which also stops
 *   the contact and product-submission forms from sending -- hence TOTAL,
 *   kept below a personal Gmail's ~500/day so those forms keep headroom.
 */
export const CODE_LIMITS = {
	perEmail: { max: 5, windowSeconds: 60 * 60 },
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

/** Whether a code may be sent to `email` now. Checked per address first, so a
 *  flood aimed at one inbox never touches the site-wide count. */
export async function mayRequestCode(
	db: MemberDb,
	email: string,
	limits: CodeLimits = CODE_LIMITS
) {
	const address = email.trim().toLowerCase();
	return (
		(await consume(db, `email:${address}`, limits.perEmail)) &&
		(await consume(db, 'total', limits.total))
	);
}
