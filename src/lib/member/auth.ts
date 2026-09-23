import 'server-only';
import { after } from 'next/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { DEFAULT_LOCALE, type Locale, isLocale } from '@/lib/i18n';
import { getDb } from './db';
import * as schema from './schema';
import { CODE_LENGTH, LOCALE_HEADER } from './shared';
import { sendSignInCode } from './sign-in-email';

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
	rateLimitEnabled,
}: {
	db: Parameters<typeof drizzleAdapter>[0];
	secret: string | undefined;
	baseURL: string | undefined;
	trustedOrigins?: string[];
	/** Must not block: awaiting delivery makes response time depend on SMTP. */
	deliverCode: (message: CodeMessage) => void;
	/** Unset follows Better Auth: on in production only. */
	rateLimitEnabled?: boolean;
}) {
	return betterAuth({
		secret,
		baseURL,
		trustedOrigins,
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema: {
				member: schema.member,
				memberSession: schema.memberSession,
				memberAccount: schema.memberAccount,
				memberVerification: schema.memberVerification,
				authRateLimit: schema.authRateLimit,
			},
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
		advanced: {
			cookiePrefix: 'bw',
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
		deliverCode: (message) =>
			after(() =>
				sendSignInCode(message).catch((err) =>
					console.error('[member] sign-in code email failed', err)
				)
			),
	}));
}
