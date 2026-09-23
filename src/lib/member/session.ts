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
 * The signed-in member, for a Server Component: the member, `null` when signed
 * out, or `'unavailable'` when membership cannot be served right now -- no
 * database on this deployment (every preview), or it failed. There is no
 * error.tsx under src/app, so throwing here would replace the whole document.
 *
 * Reads the request's cookies, so it makes the calling route dynamic -- call it
 * from a page, never from a layout, where it would take every page beneath out
 * of static generation. Returns only what a page may show.
 */
export async function getCurrentMember(): Promise<
	{ email: string; memberSince: Date } | null | 'unavailable'
> {
	// headers() FIRST, as its own statement, and OUTSIDE the try below.
	// `next build` still prerenders this route once, and headers() is what tells
	// Next to stop and render per request -- by throwing a signal Next must
	// receive, which a catch here would swallow. Written inline as
	// `getAuth().api.getSession({ headers: await headers() })`, getAuth() is
	// evaluated first and the build opens the database, which it has not got.
	const requestHeaders = await headers();
	if (!process.env.DATABASE_URL) return 'unavailable';
	try {
		const session = await getMemberSession(getAuth(), requestHeaders);
		if (!session) return null;
		return { email: session.user.email, memberSince: session.user.createdAt };
	} catch (err) {
		console.error('[member] session read failed', err);
		return 'unavailable';
	}
}
