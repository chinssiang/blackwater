import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import * as schema from './schema';

export type AttendanceRow = {
	lumaEventUrl: string;
	eventName: string;
	eventStartsAt: Date | null;
	checkedIn: boolean;
};

/** The events a member registered for or attended, from `event_attendance`
 *  (see its note in ./schema.ts). Keyed by the member's own email, which
 *  Better Auth stores lowercased, as rows must be written. */
export async function getMemberAttendance(
	email: string
): Promise<AttendanceRow[]> {
	const a = schema.eventAttendance;
	const rows = await getDb()
		.select({
			lumaEventUrl: a.lumaEventUrl,
			eventName: a.eventName,
			eventStartsAt: a.eventStartsAt,
			checkedInAt: a.checkedInAt,
		})
		.from(a)
		.where(eq(a.email, email.toLowerCase()));
	return rows.map(({ checkedInAt, ...row }) => ({
		...row,
		checkedIn: checkedInAt !== null,
	}));
}
