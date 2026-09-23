import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRIVACY_NOTICE_VERSION, createAuth } from './auth';
import { CODE_LIMITS, type CodeLimits } from './code-limits';
import * as schema from './schema';
import { getMemberSession } from './session';
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

async function setup({
	rateLimit = false,
	mailConfigured = true,
	codeLimits = CODE_LIMITS,
}: {
	rateLimit?: boolean;
	mailConfigured?: boolean;
	codeLimits?: CodeLimits;
} = {}) {
	await pg.exec(
		'truncate member, member_session, member_account, member_verification, auth_rate_limit, sign_in_code_limit cascade'
	);
	const sent: Sent[] = [];
	const auth = createAuth({
		db,
		secret: 'test-secret-that-is-long-enough-for-better-auth',
		baseURL: ORIGIN,
		deliverCode: (m) => sent.push(m),
		canDeliverCode: () => mailConfigured,
		rateLimitEnabled: rateLimit,
		codeLimits,
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

	/** Signs in end to end and returns the cookie to send back. */
	const signedIn = async (email = 'runner@example.com') => {
		await requestCode(email);
		const cookie = sessionCookie(await signIn(email, sent.at(-1)!.code));
		if (!cookie) throw new Error('sign-in set no session cookie');
		return cookie;
	};

	const getSession = (cookie: string) =>
		auth.handler(
			new Request(`${ORIGIN}/api/auth/get-session`, { headers: { cookie } })
		);

	return { pg, auth, sent, post, requestCode, signIn, signedIn, getSession };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

/** The full Set-Cookie line for the session cookie, attributes included. */
function sessionSetCookie(res: Response) {
	return res.headers
		.getSetCookie()
		.find((c) => c.startsWith('bw.session_token='));
}

/** The `name=value` pair of the session cookie, as a browser would send it. */
function sessionCookie(res: Response) {
	return sessionSetCookie(res)?.split(';')[0];
}

/** Any six digits that are not `code`. */
const wrongCodeFor = (code: string) =>
	code === '000000' ? '111111' : '000000';

describe('member sign-in', () => {
	let ctx: Ctx;
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
		const cookie = await ctx.signedIn();
		const session = await ctx.auth.api.getSession({
			headers: new Headers({ cookie }),
		});
		expect(session?.user.email).toBe('runner@example.com');
	});

	it('rejects a wrong code, and a right code used twice', async () => {
		await ctx.requestCode('runner@example.com');
		const { code } = ctx.sent[0];
		const wrong = wrongCodeFor(code);
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
		const wrong = wrongCodeFor(code);
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
		const cookie = await ctx.signedIn();
		const res = await ctx.post(
			'/sign-out',
			{},
			{ cookie, origin: 'https://evil.example' }
		);
		expect(res.status).toBe(403);
	});

	it('signs out, after which the cookie no longer works', async () => {
		const cookie = await ctx.signedIn();
		expect((await ctx.post('/sign-out', {}, { cookie })).status).toBe(200);
		const session = await ctx.auth.api.getSession({
			headers: new Headers({ cookie }),
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

// A member stays signed in while they keep coming back: each visit more than a
// day after the last refresh pushes the session out to a fresh 30 days. That
// refresh has to go through the API route -- a Server Component cannot set a
// cookie, so the /account page's own session read can extend the database row
// but never the cookie. SessionRefresh on that page exists for this.
describe('staying signed in', () => {
	let ctx: Ctx;
	beforeEach(async () => {
		ctx = await setup();
	});

	const daysLeft = async () => {
		const { rows } = await ctx.pg.query<{ days: number }>(
			'select extract(epoch from expires_at - now()) / 86400 as days from member_session'
		);
		return Number(rows[0].days);
	};

	it('extends a day-old session and re-issues its cookie for another 30 days', async () => {
		const cookie = await ctx.signedIn();
		// Two days since the last refresh (updateAge is one day).
		await ctx.pg.exec(
			"update member_session set expires_at = now() + interval '28 days'"
		);

		const res = await ctx.getSession(cookie);
		expect(res.status).toBe(200);
		expect(sessionSetCookie(res)).toMatch(/Max-Age=2592000/);
		expect(await daysLeft()).toBeGreaterThan(29.9);
	});

	it('still re-issues the cookie after the page has read the session on the server', async () => {
		// The real order on /account: getCurrentMember() reads the session in a
		// Server Component (which cannot set a cookie), THEN SessionRefresh calls
		// the route. If the server read refreshed the row, the route would see a
		// fresh session and re-issue nothing -- the cookie would still die 30 days
		// after sign-in.
		const cookie = await ctx.signedIn();
		await ctx.pg.exec(
			"update member_session set expires_at = now() + interval '28 days'"
		);

		await getMemberSession(ctx.auth, new Headers({ cookie }));
		const res = await ctx.getSession(cookie);
		expect(sessionSetCookie(res)).toMatch(/Max-Age=2592000/);
	});

	it('leaves a fresh session alone, so a visit costs no write', async () => {
		const cookie = await ctx.signedIn();
		const res = await ctx.getSession(cookie);
		expect(res.status).toBe(200);
		expect(sessionCookie(res)).toBeUndefined();
	});

	it('signs out a member who has not been back for 30 days', async () => {
		const cookie = await ctx.signedIn();
		await ctx.pg.exec(
			"update member_session set expires_at = now() - interval '1 second'"
		);
		const res = await ctx.getSession(cookie);
		expect(await res.json()).toBeNull();
	});
});

// Better Auth limits code requests per IP only. These cover an attacker who
// rotates IPs: at one inbox, or at the SMTP account's daily cap.
describe('code request limits', () => {
	it('refuses a sixth code for one address in an hour, without replacing the fifth', async () => {
		const ctx = await setup();
		const statuses = [];
		for (let i = 0; i < 6; i++) {
			statuses.push((await ctx.requestCode('runner@example.com')).status);
		}
		expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
		expect(ctx.sent).toHaveLength(5);
		// Refused before the endpoint ran, so the code in the member's inbox
		// still works -- a flood cannot keep invalidating it.
		const res = await ctx.signIn('runner@example.com', ctx.sent[4].code);
		expect(res.status).toBe(200);
	});

	it('counts an address however it is cased', async () => {
		const ctx = await setup({
			codeLimits: { ...CODE_LIMITS, perEmail: { max: 1, windowSeconds: 3600 } },
		});
		expect((await ctx.requestCode('runner@example.com')).status).toBe(200);
		expect((await ctx.requestCode(' RUNNER@Example.com ')).status).toBe(429);
	});

	it('stops every code once the site-wide cap is spent', async () => {
		const ctx = await setup({
			codeLimits: { ...CODE_LIMITS, total: { max: 2, windowSeconds: 86400 } },
		});
		const statuses = [];
		for (const email of ['a@example.com', 'b@example.com', 'c@example.com']) {
			statuses.push((await ctx.requestCode(email)).status);
		}
		expect(statuses).toEqual([200, 200, 429]);
	});

	it('refuses to issue a code at all when mail cannot be sent', async () => {
		// Better Auth swallows errors thrown by the sender, so without this the
		// form would say "check your email" for a code that never comes.
		const ctx = await setup({ mailConfigured: false });
		const res = await ctx.requestCode('runner@example.com');
		expect(res.status).toBe(503);
		expect(ctx.sent).toHaveLength(0);
		const { rows } = await ctx.pg.query('select id from member_verification');
		expect(rows).toHaveLength(0);
	});

	it('gives each visitor their own IP bucket behind a proxy that appends to x-forwarded-for', async () => {
		const ctx = await setup({ rateLimit: true });
		const from = (ip: string, email: string) =>
			ctx.requestCode(email, {
				'x-forwarded-for': `${ip}, 198.51.100.1`,
				'x-vercel-forwarded-for': ip,
			});
		for (let i = 0; i < 3; i++) await from('203.0.113.10', `a${i}@example.com`);
		expect((await from('203.0.113.10', 'a3@example.com')).status).toBe(429);
		// A different visitor is not caught in the first one's bucket.
		expect((await from('203.0.113.20', 'b@example.com')).status).toBe(200);
	});
});
