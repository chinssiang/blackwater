import 'server-only';
import { after } from 'next/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { DEFAULT_LOCALE, type Locale, isLocale } from '@/lib/i18n';
import { type CodeLimits, type MemberDb, mayRequestCode } from './code-limits';
import { getDb } from './db';
import * as schema from './schema';
import { CODE_LENGTH, LOCALE_HEADER } from './shared';
import { isMailConfigured, sendSignInCode } from './sign-in-email';

/**
 * Stamped on each member when the account is created, as the record of which
 * privacy notice they saw. Bump it whenever `account.signIn.privacy` changes
 * in EITHER dictionary -- otherwise existing records claim consent to wording
 * the member never read.
 */
export const PRIVACY_NOTICE_VERSION = '2026-09-23';

type CodeMessage = { email: string; code: string; locale: Locale };

export function createAuth({
	db,
	secret,
	baseURL,
	trustedOrigins,
	deliverCode,
	canDeliverCode,
	rateLimitEnabled,
	codeLimits,
}: {
	db: MemberDb;
	secret: string | undefined;
	baseURL: string | undefined;
	trustedOrigins?: string[];
	/** Must not block: awaiting delivery makes response time depend on SMTP. */
	deliverCode: (message: CodeMessage) => void;
	/** Whether mail can go out at all. Checked BEFORE a code is issued: Better
	 *  Auth swallows anything the sender throws, so a missing credential there
	 *  would tell the member "check your email" for a code that never comes. */
	canDeliverCode: () => boolean;
	/** Unset follows Better Auth: on in production only. */
	rateLimitEnabled?: boolean;
	codeLimits?: CodeLimits;
}) {
	return betterAuth({
		secret,
		baseURL,
		trustedOrigins,
		database: drizzleAdapter(db, {
			provider: 'pg',
			// Keyed by model name; signInCodeLimit is ours and the adapter ignores it.
			schema,
		}),
		user: {
			modelName: 'member',
			additionalFields: {
				// `input: false` -- set by the hook below, never by the client.
				consentVersion: { type: 'string', required: false, input: false },
			},
		},
		session: {
			modelName: 'memberSession',
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
		},
		account: { modelName: 'memberAccount' },
		verification: { modelName: 'memberVerification' },
		rateLimit: {
			enabled: rateLimitEnabled,
			// Shared by every instance; the default in-memory store is per
			// instance, which is the flaw the site's other forms already have.
			storage: 'database',
			modelName: 'authRateLimit',
		},
		hooks: {
			// Before the endpoint runs, so a refused request neither issues a code
			// nor replaces the one the member is about to type.
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== '/email-otp/send-verification-otp') return;
				if (ctx.body?.type !== 'sign-in') return;
				if (!canDeliverCode()) {
					console.error('[member] sign-in email is not configured');
					throw new APIError('SERVICE_UNAVAILABLE');
				}
				const email = ctx.body?.email;
				if (typeof email !== 'string') return; // the endpoint rejects it
				if (!(await mayRequestCode(db, email, codeLimits))) {
					throw new APIError('TOO_MANY_REQUESTS');
				}
			}),
		},
		advanced: {
			cookiePrefix: 'bw',
			// Vercel sets these two to the client's address as a single value.
			// Better Auth trusts a forwarded header only when it holds ONE value,
			// so a proxy that appends to x-forwarded-for (a CDN in front of
			// Vercel) would otherwise put every visitor in one shared bucket.
			ipAddress: {
				ipAddressHeaders: [
					'x-vercel-forwarded-for',
					'x-real-ip',
					'x-forwarded-for',
				],
			},
			// Already false in production. Stated because Better Auth defaults it
			// to TRUE when NODE_ENV is 'test', which silently switches off its
			// CSRF check too -- so without this the test suite would be proving
			// the protection works while running with it disabled.
			disableOriginCheck: false,
		},
		databaseHooks: {
			user: {
				create: {
					before: async (user) => ({
						data: { ...user, consentVersion: PRIVACY_NOTICE_VERSION },
					}),
				},
			},
		},
		plugins: [
			emailOTP({
				// The library default is 'plain': anyone who can read the table
				// could sign in as whoever has a code outstanding.
				storeOTP: 'hashed',
				otpLength: CODE_LENGTH,
				// Default 5 minutes is tight for a phone user switching apps.
				expiresIn: 60 * 10,
				async sendVerificationOTP({ email, otp, type }, ctx) {
					// Sign-in is the only flow this site offers. The endpoint still
					// accepts other types, which must not send mail.
					if (type !== 'sign-in') return;
					const header = ctx?.headers?.get(LOCALE_HEADER);
					deliverCode({
						email,
						code: otp,
						locale: header && isLocale(header) ? header : DEFAULT_LOCALE,
					});
				},
			}),
		],
	});
}

let auth: ReturnType<typeof createAuth> | undefined;

/** Created on first use -- see the note in ./db.ts. */
export function getAuth() {
	return (auth ??= createAuth({
		db: getDb(),
		secret: process.env.BETTER_AUTH_SECRET,
		baseURL: process.env.SITE_URL,
		// A deployment must accept requests from its own URL, or sign-in fails
		// on every Vercel preview (SITE_URL names production). Unset elsewhere.
		trustedOrigins: [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
			.filter(Boolean)
			.map((host) => `https://${host}`),
		canDeliverCode: isMailConfigured,
		deliverCode: (message) =>
			after(() =>
				sendSignInCode(message).catch((err) =>
					console.error('[member] sign-in code email failed', err)
				)
			),
	}));
}
