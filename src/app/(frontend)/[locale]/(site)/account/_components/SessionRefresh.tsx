'use client';

import { useEffect } from 'react';

/**
 * Keeps a returning member signed in. The page's own session read runs in a
 * Server Component, which cannot set cookies -- so it can extend the database
 * row but never the cookie, and the member would be signed out 30 days after
 * signing in however often they came back. Reading the session through the API
 * route lets Better Auth re-issue the cookie. It does so at most once a day
 * (`updateAge`), so most visits cost one read and no write.
 */
export function SessionRefresh() {
	useEffect(() => {
		fetch('/api/auth/get-session').catch(() => {});
	}, []);
	return null;
}
