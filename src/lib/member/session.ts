import 'server-only';
import { headers } from 'next/headers';
import { type createAuth, getAuth } from './auth';

/**
 * The session read `getCurrentMember()` makes, taking the auth instance so a
 * test can drive the same call.
 *
 * `disableRefresh` is load-bearing. This runs in a Server Component, which
 * cannot set cookies, so a refresh here would extend the database row and drop
 * the re-issued cookie. Worse, SessionRefresh's request a moment later would
 * then see a freshly-refreshed row and re-issue nothing -- so the cookie would
 * still die 30 days after sign-in. Refreshing only through the API route is
 * what lets that route actually do it.
 */
export function getMemberSession(
	auth: ReturnType<typeof createAuth>,
	requestHeaders: Headers
) {
	return auth.api.getSession({
		headers: requestHeaders,
		query: { disableRefresh: true },
	});
}

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
	const session = await getMemberSession(getAuth(), requestHeaders);
	if (!session) return null;
	return { email: session.user.email, memberSince: session.user.createdAt };
}
