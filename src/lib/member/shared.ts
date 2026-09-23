import type { EMAIL_OTP_ERROR_CODES } from 'better-auth/client/plugins';

/*
 * What the sign-in form and the auth config must agree on. A leaf with no
 * server-only import, so the client form can read it -- ./auth.ts cannot be.
 */

/** Sent by the sign-in form so the code email arrives in the page's language. */
export const LOCALE_HEADER = 'x-bw-locale';

export const CODE_LENGTH = 6;

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
