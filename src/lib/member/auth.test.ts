import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRIVACY_NOTICE_VERSION, createAuth } from './auth';
import * as schema from './schema';
import { LOCALE_HEADER, SIGN_IN_ERRORS } from './shared';

// The whole sign-in flow, end to end: the committed migration applied to a real
// Postgres engine (PGlite, in-process, so CI needs no database service), driven
// through the same HTTP endpoints the sign-in form calls.

const ORIGIN = 'http://localhost:3001';

type Sent = { email: string; code: string; locale: string };

// One engine for the file, emptied per test: starting PGlite and migrating it
// costs ~3s, which per test made this the slowest file in the suite by far.
let pg: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
beforeAll(async () => {
	pg = new PGlite();
	db = drizzle(pg, { schema });
	await migrate(db, { migrationsFolder: 'drizzle' });
});

async function setup({ rateLimit = false } = {}) {
	await pg.exec(
		'truncate member, member_session, member_account, member_verification, auth_rate_limit cascade'
	);
	const sent: Sent[] = [];
	const auth = createAuth({
		db,
		secret: 'test-secret-that-is-long-enough-for-better-auth',
		baseURL: ORIGIN,
		deliverCode: (m) => sent.push(m),
		rateLimitEnabled: rateLimit,
	});

	const post = (
		path: string,
		body: unknown,
		headers: Record<string, string> = {}
	) =>
		auth.handler(
			new Request(`${ORIGIN}/api/auth${path}`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					origin: ORIGIN,
					'x-forwarded-for': '203.0.113.7',
					...headers,
				},
				body: JSON.stringify(body),
			})
		);

	const requestCode = (email: string, headers?: Record<string, string>) =>
		post(
			'/email-otp/send-verification-otp',
			{ email, type: 'sign-in' },
			headers
		);

	const signIn = (email: string, otp: string) =>
		post('/sign-in/email-otp', { email, otp });

	return { pg, auth, sent, post, requestCode, signIn };
}

/** The `name=value` pair of the session cookie, as a browser would send it. */
function sessionCookie(res: Response) {
	const cookie = res.headers
		.getSetCookie()
		.find((c) => c.startsWith('bw.session_token='));
	return cookie?.split(';')[0];
}

describe('member sign-in', () => {
	let ctx: Awaited<ReturnType<typeof setup>>;
	beforeEach(async () => {
		ctx = await setup();
	});

	it('emails a 6-digit code in the language the form asked for', async () => {
		const res = await ctx.requestCode('runner@example.com', {
			[LOCALE_HEADER]: 'zh_tw',
		});
		expect(res.status).toBe(200);
		expect(ctx.sent).toHaveLength(1);
		expect(ctx.sent[0].code).toMatch(/^\d{6}$/);
		expect(ctx.sent[0].locale).toBe('zh_tw');
	});

	it('falls back to English for a missing or unknown locale', async () => {
		await ctx.requestCode('a@example.com');
		await ctx.requestCode('b@example.com', { [LOCALE_HEADER]: 'fr' });
		expect(ctx.sent.map((m) => m.locale)).toEqual(['en', 'en']);
	});

	it('never stores the code itself', async () => {
		await ctx.requestCode('runner@example.com');
		const { rows } = await ctx.pg.query<{ value: string }>(
			'select value from member_verification'
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].value).not.toContain(ctx.sent[0].code);
	});

	it('does not email a code for a flow the site does not offer', async () => {
		const res = await ctx.post('/email-otp/send-verification-otp', {
			email: 'runner@example.com',
			type: 'forget-password',
		});
		expect(res.status).toBeLessThan(500);
		expect(ctx.sent).toHaveLength(0);
	});

	it('creates the member on first sign-in and records the notice they saw', async () => {
		await ctx.requestCode('runner@example.com');
		const res = await ctx.signIn('runner@example.com', ctx.sent[0].code);
		expect(res.status).toBe(200);
		expect(sessionCookie(res)).toBeDefined();

		const { rows } = await ctx.pg.query<{
			email: string;
			email_verified: boolean;
			consent_version: string;
		}>('select email, email_verified, consent_version from member');
		expect(rows).toEqual([
			{
				email: 'runner@example.com',
				email_verified: true,
				consent_version: PRIVACY_NOTICE_VERSION,
			},
		]);
	});

	it('treats a differently-cased address as the same member', async () => {
		// Email is the join key to Luma, Klaviyo and Shopify, so two rows for one
		// person would split their history.
		await ctx.requestCode('Runner@Example.com');
		await ctx.signIn('runner@example.com', ctx.sent[0].code);
		await ctx.requestCode('RUNNER@example.com');
		await ctx.signIn('RUNNER@example.com', ctx.sent[1].code);
		const { rows } = await ctx.pg.query('select id from member');
		expect(rows).toHaveLength(1);
	});

	it('returns the member for a request carrying the session cookie', async () => {
		await ctx.requestCode('runner@example.com');
		const cookie = sessionCookie(
			await ctx.signIn('runner@example.com', ctx.sent[0].code)
		);
		const session = await ctx.auth.api.getSession({
			headers: new Headers({ cookie: cookie! }),
		});
		expect(session?.user.email).toBe('runner@example.com');
	});

	it('rejects a wrong code, and a right code used twice', async () => {
		await ctx.requestCode('runner@example.com');
		const { code } = ctx.sent[0];
		const wrong = code === '000000' ? '111111' : '000000';
		const first = await ctx.signIn('runner@example.com', wrong);
		expect(first.status).toBe(400);
		// The form picks its message from this field (see SIGN_IN_ERRORS).
		expect((await first.json()).code).toBe(SIGN_IN_ERRORS.invalid);
		expect((await ctx.signIn('runner@example.com', code)).status).toBe(200);
		expect((await ctx.signIn('runner@example.com', code)).status).toBe(400);
	});

	it('burns the code after three wrong attempts', async () => {
		await ctx.requestCode('runner@example.com');
		const { code } = ctx.sent[0];
		const wrong = code === '000000' ? '111111' : '000000';
		for (let i = 0; i < 3; i++) await ctx.signIn('runner@example.com', wrong);
		const res = await ctx.signIn('runner@example.com', code);
		expect(res.status).toBe(403);
		expect((await res.json()).code).toBe(SIGN_IN_ERRORS.tooManyAttempts);
		expect(sessionCookie(res)).toBeUndefined();
	});

	it('reports an expired code as expired, not as wrong', async () => {
		await ctx.requestCode('runner@example.com');
		await ctx.pg.exec(
			"update member_verification set expires_at = now() - interval '1 second'"
		);
		const res = await ctx.signIn('runner@example.com', ctx.sent[0].code);
		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe(SIGN_IN_ERRORS.expired);
	});

	it('refuses a signed-in request from another origin', async () => {
		await ctx.requestCode('runner@example.com');
		const cookie = sessionCookie(
			await ctx.signIn('runner@example.com', ctx.sent[0].code)
		);
		const res = await ctx.post(
			'/sign-out',
			{},
			{ cookie: cookie!, origin: 'https://evil.example' }
		);
		expect(res.status).toBe(403);
	});

	it('signs out, after which the cookie no longer works', async () => {
		await ctx.requestCode('runner@example.com');
		const cookie = sessionCookie(
			await ctx.signIn('runner@example.com', ctx.sent[0].code)
		);
		expect((await ctx.post('/sign-out', {}, { cookie: cookie! })).status).toBe(
			200
		);
		const session = await ctx.auth.api.getSession({
			headers: new Headers({ cookie: cookie! }),
		});
		expect(session).toBeNull();
	});
});

describe('member sign-in rate limit', () => {
	it('stops a fourth code request inside a minute, counted in the database', async () => {
		const ctx = await setup({ rateLimit: true });
		const statuses = [];
		for (let i = 0; i < 4; i++) {
			statuses.push((await ctx.requestCode('runner@example.com')).status);
		}
		expect(statuses).toEqual([200, 200, 200, 429]);
		expect(ctx.sent).toHaveLength(3);
		// In the table rather than a process-local map, so every Vercel instance
		// shares one count.
		const { rows } = await ctx.pg.query('select key from auth_rate_limit');
		expect(rows.length).toBeGreaterThan(0);
	});
});
