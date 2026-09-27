import 'server-only';
import { and, desc, eq, gt } from 'drizzle-orm';
import { getDb } from './db';
import * as schema from './schema';

export type MemberDevice = {
	id: string;
	userAgent: string;
	signedInAt: Date;
	/** When the session was last refreshed -- at most a day stale (updateAge). */
	lastSeenAt: Date;
	current: boolean;
};

/**
 * The member's live sessions, for Settings -> Signed-in devices. Read here
 * rather than through Better Auth's list-sessions route, which hands every
 * session's TOKEN to the browser -- a script on the page could then sign in as
 * each of the member's other devices. Nothing here returns one.
 */
export async function listMemberDevices(
	memberId: string,
	currentSessionId: string
): Promise<MemberDevice[]> {
	const s = schema.memberSession;
	const rows = await getDb()
		.select({
			id: s.id,
			userAgent: s.userAgent,
			createdAt: s.createdAt,
			updatedAt: s.updatedAt,
		})
		.from(s)
		.where(and(eq(s.userId, memberId), gt(s.expiresAt, new Date())))
		.orderBy(desc(s.updatedAt));
	return rows.map((row) => ({
		id: row.id,
		userAgent: row.userAgent ?? '',
		signedInAt: row.createdAt,
		lastSeenAt: row.updatedAt,
		current: row.id === currentSessionId,
	}));
}
