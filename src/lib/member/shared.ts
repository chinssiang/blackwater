import type { EMAIL_OTP_ERROR_CODES } from 'better-auth/client/plugins';

/*
 * What the sign-in form and the auth config must agree on. A leaf with no
 * server-only import, so the client form can read it -- ./auth.ts cannot be.
 */

/** Sent by the sign-in form so the code email arrives in the page's language. */
export const LOCALE_HEADER = 'x-bw-locale';

export const CODE_LENGTH = 6;

/** The longest first or last name the account form accepts and auth.ts saves. */
export const NAME_MAX_LENGTH = 50;

/** The rest of the profile's limits, shared the same way. A phone number is
 *  at most 15 digits (E.164), so 30 leaves room for spaces and punctuation. */
export const PHONE_MAX_LENGTH = 30;
export const CONTACT_NAME_MAX_LENGTH = 100;

/**
 * The `code` Better Auth's delete-user route answers with when the session is
 * older than a day (its `freshAge`). A member signed in with a code has no
 * password to confirm with, so the page asks them to sign in again. Pinned
 * against the real response by auth.test.ts.
 */
export const DELETE_NEEDS_FRESH_SIGN_IN = 'SESSION_EXPIRED';

/**
 * A readable copy of "is there a session cookie", for the header -- which
 * cannot read the httpOnly session cookie, and must not ask the server (that
 * would take every page out of static generation). auth.ts writes it whenever
 * Better Auth writes the session cookie. A UI hint only: it holds no token,
 * anyone can set it, and nothing may be gated on it.
 */
export const SIGNED_IN_HINT_COOKIE = 'bw_member';

/**
 * The `code` field of Better Auth's JSON error body for a failed sign-in, which
 * the form chooses its message from. Checked against the library's own list at
 * compile time -- a type-only import, so none of its plugin barrel reaches the
 * browser -- and against real responses by auth.test.ts.
 */
export const SIGN_IN_ERRORS = {
	invalid: 'INVALID_OTP',
	expired: 'OTP_EXPIRED',
	tooManyAttempts: 'TOO_MANY_ATTEMPTS',
} as const satisfies Record<string, keyof typeof EMAIL_OTP_ERROR_CODES>;
