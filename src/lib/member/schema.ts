import {
	bigint,
	boolean,
	index,
	integer,
	pgTable,
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
