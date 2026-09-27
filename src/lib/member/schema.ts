import {
	bigint,
	boolean,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';

/*
 * The five tables Better Auth needs, renamed onto the club's vocabulary
 * (`src/lib/member/auth.ts` maps each model to its table by these export
 * names). Field names are Better Auth's and must stay camelCase in JS; only
 * the SQL columns are snake_case.
 *
 * Deliberately NOT imported with `server-only`: drizzle-kit loads this file
 * in plain Node to generate migrations, where that import throws.
 */

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow(),
};

/** One row per person. Email is the join key to Luma, Klaviyo and Shopify. */
export const member = pgTable('member', {
	id: text('id').primaryKey(),
	// Required by Better Auth; the email-code flow creates members with ''.
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	// Split the way Luma and Shopify split them, so a member's name can be
	// matched against, or prefilled from, their guest and customer records.
	firstName: text('first_name').notNull().default(''),
	lastName: text('last_name').notNull().default(''),
	// The rest of the profile, each '' until the member fills it in. Named for
	// the fields Luma, Shopify and Klaviyo already hold, so a value found there
	// can be written straight in. Validated in auth.ts, which is the only writer.
	phone: text('phone').notNull().default(''),
	// ISO 3166-1 alpha-2, upper case -- the code Shopify and Klaviyo store.
	country: text('country').notNull().default(''),
	// A civil date, `yyyy-MM-dd`, the shape <input type="date"> reads and
	// writes. Text rather than `date` so "not given" is '' like every other
	// field here, and no driver turns it into a midnight in some timezone.
	birthday: text('birthday').notNull().default(''),
	emergencyContactName: text('emergency_contact_name').notNull().default(''),
	emergencyContactPhone: text('emergency_contact_phone').notNull().default(''),
	// The language the club emails the member in. '' follows the page they
	// signed in from.
	preferredLocale: text('preferred_locale').notNull().default(''),
	// Which privacy notice the member saw when the account was created. Its
	// date is `createdAt`; a re-consent flow would need its own timestamp.
	consentVersion: text('consent_version'),
	...timestamps,
});

export const memberSession = pgTable(
	'member_session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('member_id')
			.notNull()
			.references(() => member.id, { onDelete: 'cascade' }),
		...timestamps,
	},
	(t) => [index('member_session_member_id_idx').on(t.userId)]
);

/**
 * One row per external sign-in method. Email-code sign-in writes nothing here,
 * so it stays empty -- but Better Auth's sign-out and account routes read it,
 * so the table cannot be dropped.
 */
export const memberAccount = pgTable(
	'member_account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('member_id')
			.notNull()
			.references(() => member.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
			withTimezone: true,
		}),
		scope: text('scope'),
		password: text('password'),
		...timestamps,
	},
	(t) => [index('member_account_member_id_idx').on(t.userId)]
);

/** Pending sign-in codes, stored hashed. */
export const memberVerification = pgTable(
	'member_verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		...timestamps,
	},
	(t) => [index('member_verification_identifier_idx').on(t.identifier)]
);

/**
 * Rate-limit counters. In the database rather than in memory because Vercel
 * runs many instances, and a per-instance counter multiplies the real limit
 * by however many happen to be warm.
 */
export const authRateLimit = pgTable('auth_rate_limit', {
	id: text('id').primaryKey(),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

/**
 * Sign-in code requests counted per email address and in total, on top of
 * Better Auth's per-IP limit. Its own table rather than authRateLimit's rows:
 * Better Auth prunes those after its own (short) window, which would reset
 * these hour- and day-long counts early. See ./code-limits.ts.
 */
export const signInCodeLimit = pgTable('sign_in_code_limit', {
	key: text('key').primaryKey(),
	count: integer('count').notNull(),
	windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
});

/**
 * Which events a person registered for or turned up to, one row per person per
 * event. Nothing writes it yet: it is the landing place for a Luma webhook or
 * backfill, and /account's club history reads it.
 *
 * Keyed by EMAIL, not by member id, and with no foreign key to `member`, on
 * purpose: Luma's history predates membership, so a backfill must be able to
 * hold rows for someone who signs up next year, and the history appears the
 * moment they do. Emails are stored lowercased, as Better Auth stores them.
 *
 * `lumaEventUrl` is the join key to `pEvent.lumaUrl` and is written only in
 * the spelling `normalizeLumaEventUrl()` returns (src/lib/luma.ts). The name
 * and start time are Luma's own, for an event the site has no page for.
 */
export const eventAttendance = pgTable(
	'event_attendance',
	{
		email: text('email').notNull(),
		lumaEventUrl: text('luma_event_url').notNull(),
		eventName: text('event_name').notNull().default(''),
		eventStartsAt: timestamp('event_starts_at', { withTimezone: true }),
		registeredAt: timestamp('registered_at', { withTimezone: true }),
		// Set once the crew checks the runner in at the event.
		checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
		...timestamps,
	},
	(t) => [primaryKey({ columns: [t.email, t.lumaEventUrl] })]
);
