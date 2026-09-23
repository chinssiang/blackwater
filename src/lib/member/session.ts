import 'server-only';
import { headers } from 'next/headers';
import { getAuth } from './auth';

/**
 * The signed-in member, for a Server Component. Reads the request's cookies,
 * so it makes the calling route dynamic -- call it from a page, never from a
 * layout, where it would take every page beneath out of static generation.
 *
 * Returns only what a page may show, rather than the session and user rows.
 */
export async function getCurrentMember() {
	// headers() FIRST, as its own statement. `next build` still prerenders this
	// route once, and it is headers() that tells Next to stop and render per
	// request instead. Written inline as `getAuth().api.getSession({ headers:
	// await headers() })`, getAuth() is evaluated before its argument, so the
	// database is opened during the build -- which has no DATABASE_URL.
	const requestHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: requestHeaders });
	if (!session) return null;
	return { email: session.user.email, memberSince: session.user.createdAt };
}
