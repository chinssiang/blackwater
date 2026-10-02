import 'server-only';
import { after } from 'next/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getIP } from 'better-auth/api';
import { emailOTP } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import * as z from 'zod';
import { DEFAULT_LOCALE, LOCALES, type Locale, isLocale } from '@/lib/i18n';
import { isMailConfigured } from '@/lib/mail';
import { type CodeLimits, type MemberDb, mayRequestCode } from './code-limits';
import { COUNTRY_CODES } from './countries';
import { getDb } from './db';
import { hashEmail } from './luma-import';
import * as schema from './schema';
import {
	CODE_LENGTH,
	CONTACT_NAME_MAX_LENGTH,
	LOCALE_HEADER,
	NAME_MAX_LENGTH,
	PHONE_MAX_LENGTH,
	SIGNED_IN_HINT_COOKIE,
} from './shared';

/**
 * Stamped on each member when the account is created, as the record of which
 * privacy notice they saw. Bump it whenever `pAccount.signInPrivacy` changes
 * in Sanity, in EITHER language -- otherwise existing records claim consent to wording
 * the member never read.
 */
export const PRIVACY_NOTICE_VERSION = '2026-09-27.2';

type CodeMessage = { email: string; code: string; locale: Locale };

// Every profile field is '' until the member saves one, so "not given" has one
// spelling, and each can be cleared. `required` only types the field `string`:
// creation fills the default, and updates are never held to it.
const profileField = (input: z.ZodType<string>) =>
	({
		type: 'string',
		required: true,
		defaultValue: '',
		validator: { input },
	}) as const;

const oneOf = (values: Iterable<string>) => {
	const allowed = new Set(values);
	return z.string().refine((v) => v === '' || allowed.has(v));
};

// At least one digit, with the punctuation people type around them -- `(02)`
// included -- and an optional leading +. Deliberately not a per-country format: a Taiwanese mobile, a
// Japanese landline and a number written the way Luma exported it all pass.
const phone = z
	.string()
	.trim()
	.max(PHONE_MAX_LENGTH)
	.regex(/^(\+?[\d ().-]*\d[\d ().-]*)?$/);

/** A real calendar date, `yyyy-MM-dd`, from 1900 to today (UTC, plus a day
 *  for a member already past midnight east of Greenwich). */
function isBirthday(value: string) {
	if (value === '') return true;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const [year, month, day] = match.slice(1).map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	// Date.UTC rolls 02-31 over into March; a real date survives the trip.
	if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
		return false;
	}
	return year >= 1900 && date.getTime() <= Date.now() + 864e5;
}

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
				// Set by the member on /account, through Better Auth's update-user
				// route -- which is what checks the session and the origin.
				firstName: profileField(z.string().trim().max(NAME_MAX_LENGTH)),
				lastName: profileField(z.string().trim().max(NAME_MAX_LENGTH)),
				phone: profileField(phone),
				country: profileField(oneOf(COUNTRY_CODES)),
				birthday: profileField(z.string().refine(isBirthday)),
				emergencyContactName: profileField(
					z.string().trim().max(CONTACT_NAME_MAX_LENGTH)
				),
				emergencyContactPhone: profileField(phone),
				preferredLocale: profileField(oneOf(LOCALES)),
			},
			// Settings -> Delete account, through Better Auth's delete-user route.
			// With no password to confirm, the route asks for a session under a
			// day old (its `freshAge`), so a borrowed, long-open tab cannot do it.
			deleteUser: {
				enabled: true,
				// Before, so a failure here leaves the member intact to try again.
				// The attendance rows are keyed by email and hold no foreign key,
				// so the cascade that removes their sessions does not reach them.
				// The erasure is recorded first, so a later Luma import cannot write
				// their history back (see eraseAttendance in ./luma-import.ts).
				beforeDelete: async (user) => {
					await db
						.insert(schema.attendanceErasure)
						.values({ emailHash: hashEmail(user.email) })
						.onConflictDoUpdate({
							target: schema.attendanceErasure.emailHash,
							set: { erasedAt: new Date() },
						});
					await db
						.delete(schema.eventAttendance)
						.where(eq(schema.eventAttendance.email, user.email));
				},
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
				// The endpoint rejects these, so they must not count against any
				// limit -- the same check it makes, on the same lowercased value.
				if (typeof email !== 'string') return;
				if (!z.email().safeParse(email.toLowerCase()).success) return;
				// Resolved the way Better Auth's own per-IP limit resolves it.
				const ip = ctx.headers ? getIP(ctx.headers, ctx.context.options) : null;
				if (!(await mayRequestCode(db, email, ip, codeLimits))) {
					throw new APIError('TOO_MANY_REQUESTS');
				}
			}),
			// Mirrors every write of the session cookie -- sign-in, the daily
			// refresh, sign-out, and the cleanup of a cookie whose session is gone
			// -- onto the header's readable hint, with the same attributes and
			// lifetime. Keyed on the cookie rather than on endpoint paths, so no
			// future way of signing in or out can forget it.
			after: createAuthMiddleware(async (ctx) => {
				const session = ctx.context.authCookies.sessionToken;
				const written = ctx.context.responseHeaders
					?.getSetCookie()
					.findLast((c) => c.startsWith(`${session.name}=`));
				let signedIn: boolean;
				if (written) {
					signedIn = !/;\s*Max-Age=0(;|$)/i.test(written);
				} else if (
					// Nothing written, but a hint arrived with no session cookie
					// beside it: the two lapse together, so it was set by hand or
					// outlived a session cookie cleared on its own.
					ctx.getCookie(SIGNED_IN_HINT_COOKIE) &&
					!ctx.getCookie(session.name)
				) {
					signedIn = false;
				} else {
					return;
				}
				ctx.setCookie(SIGNED_IN_HINT_COOKIE, signedIn ? '1' : '', {
					...session.attributes,
					httpOnly: false,
					maxAge: signedIn ? ctx.context.sessionConfig.expiresIn : 0,
				});
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
		// Better Auth's built-in `name` and `image` reach the database straight
		// from the request body -- on a first sign-in and through update-user --
		// with no validation. Nothing here sets or reads them (a member's name is
		// firstName/lastName), so any write carrying one is refused. Checked on
		// the write rather than per endpoint, so no path is missed. Thrown, not
		// `return false`: update-user answers 200 to an update a hook cancels.
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						if (user.name || user.image != null) {
							throw new APIError('BAD_REQUEST');
						}
						return {
							data: { ...user, consentVersion: PRIVACY_NOTICE_VERSION },
						};
					},
				},
				update: {
					before: async (data) => {
						if (data.name !== undefined || data.image !== undefined) {
							throw new APIError('BAD_REQUEST');
						}
					},
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
					// A member's saved language wins over the page they asked from:
					// Settings promises it is the language the club emails them in.
					const preferred = await preferredLocaleOf(db, email);
					const header = ctx?.headers?.get(LOCALE_HEADER);
					deliverCode({
						email,
						code: otp,
						locale:
							preferred ??
							(header && isLocale(header) ? header : DEFAULT_LOCALE),
					});
				},
			}),
		],
	});
}

/** The member's saved language, or null for none (or no member yet). A failed
 *  read falls back rather than throwing: Better Auth swallows what the sender
 *  throws, so a throw here would silently send no code at all. */
async function preferredLocaleOf(db: MemberDb, email: string) {
	try {
		const [row] = await db
			.select({ locale: schema.member.preferredLocale })
			.from(schema.member)
			.where(eq(schema.member.email, email.toLowerCase()))
			.limit(1);
		return row && isLocale(row.locale) ? row.locale : null;
	} catch (err) {
		console.error('[member] preferred language read failed', err);
		return null;
	}
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
				// Imported on send, like nodemailer in mail.ts: React Email's
				// renderer loads prettier and html-to-text at import, which every
				// cold start of /account and /api/auth would otherwise pay for.
				import('./sign-in-email')
					.then(({ sendSignInCode }) => sendSignInCode(message))
					.catch((err) =>
						console.error('[member] sign-in code email failed', err)
					)
			),
	}));
}
