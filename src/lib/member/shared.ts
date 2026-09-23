/*
 * What the sign-in form and the auth config must agree on. A leaf with no
 * server-only import, so the client form can read it -- ./auth.ts cannot be.
 */

/** Sent by the sign-in form so the code email arrives in the page's language. */
export const LOCALE_HEADER = 'x-bw-locale';

export const CODE_LENGTH = 6;

/**
 * The `code` field of Better Auth's JSON error body for a failed sign-in.
 * Pinned by auth.test.ts, since the form chooses its message from these.
 */
export const SIGN_IN_ERRORS = {
	invalid: 'INVALID_OTP',
	expired: 'OTP_EXPIRED',
	tooManyAttempts: 'TOO_MANY_ATTEMPTS',
} as const;
