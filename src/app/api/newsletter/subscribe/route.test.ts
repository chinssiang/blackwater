import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// The route resolves the Klaviyo list server-side so a caller cannot choose it;
// that read is the thing to stub, not the list id.
const fetchConfig = vi.fn();
vi.mock('@/sanity/lib/client', () => ({
	client: { fetch: (...args: unknown[]) => fetchConfig(...args) },
}));

const { POST } = await import('./route');

// The throttle is module-level and keyed by IP, so every test needs its own or
// the sixth call in a file gets a 429 from the fifth test's budget.
let ipCounter = 0;

function request(
	body: unknown,
	{ ip = `10.0.0.${++ipCounter}` }: { ip?: string } = {}
): NextRequest {
	return {
		headers: new Headers({ 'x-forwarded-for': ip }),
		json: async () => body,
	} as unknown as NextRequest;
}

const ORIGINAL_KEY = process.env.KLAVIYO_PRIVATE_API_KEY;

beforeEach(() => {
	process.env.KLAVIYO_PRIVATE_API_KEY = 'pk_test';
	fetchConfig.mockResolvedValue({ listId: 'L1' });
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	process.env.KLAVIYO_PRIVATE_API_KEY = ORIGINAL_KEY;
	vi.restoreAllMocks();
	fetchConfig.mockReset();
});

describe('newsletter subscribe POST', () => {
	it('rejects an invalid email with 400', async () => {
		const res = await POST(request({ email: 'nope' }));
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toMatchObject({ ok: false });
	});

	it('rejects a body that is not JSON with 400', async () => {
		const res = {
			headers: new Headers({ 'x-forwarded-for': `10.0.1.${++ipCounter}` }),
			json: async () => {
				throw new Error('bad json');
			},
		} as unknown as NextRequest;
		expect((await POST(res)).status).toBe(400);
	});

	it('returns 500 when the API key is not configured', async () => {
		delete process.env.KLAVIYO_PRIVATE_API_KEY;
		const res = await POST(request({ email: 'a@b.com' }));
		expect(res.status).toBe(500);
	});

	it('returns 500 when the locale has no list configured', async () => {
		fetchConfig.mockResolvedValue({ listId: null });
		const res = await POST(request({ email: 'a@b.com' }));
		expect(res.status).toBe(500);
	});

	it('returns 500 when the config read fails', async () => {
		fetchConfig.mockRejectedValue(new Error('sanity down'));
		const res = await POST(request({ email: 'a@b.com' }));
		expect(res.status).toBe(500);
	});

	it('calls Klaviyo with the server-resolved list and returns ok', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 200 }));
		const res = await POST(
			request({ email: 'a@b.com', placement: 'page', locale: 'zh_tw' })
		);
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ ok: true });

		// The list is looked up for the locale the caller rendered in, not chosen
		// by the caller.
		expect(fetchConfig).toHaveBeenCalledWith(
			expect.anything(),
			{ locale: 'zh_tw' },
			{ stega: false }
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toContain('a.klaviyo.com');
		expect((init?.headers as Record<string, string>).Authorization).toBe(
			'Klaviyo-API-Key pk_test'
		);
		const sent = JSON.parse(init?.body as string);
		expect(sent.data.attributes.profiles.data[0].attributes.email).toBe(
			'a@b.com'
		);
		expect(sent.data.relationships.list.data.id).toBe('L1');
		expect(sent.data.attributes.custom_source).toBe('Newsletter Page');
	});

	it('falls back to the default locale and footer placement', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 200 }));
		await POST(request({ email: 'a@b.com', locale: 'klingon' }));
		expect(fetchConfig).toHaveBeenCalledWith(
			expect.anything(),
			{ locale: 'en' },
			{ stega: false }
		);
		const sent = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
		expect(sent.data.attributes.custom_source).toBe('Newsletter Footer');
	});

	it('surfaces a Klaviyo error as 502', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('boom', { status: 400 })
		);
		expect((await POST(request({ email: 'a@b.com' }))).status).toBe(502);
	});

	it('returns 500 when the fetch throws', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
		expect((await POST(request({ email: 'a@b.com' }))).status).toBe(500);
	});

	it('throttles a single IP after five submissions', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(null, { status: 200 })
		);
		const ip = '10.9.9.9';
		for (let i = 0; i < 5; i++) {
			expect((await POST(request({ email: 'a@b.com' }, { ip }))).status).toBe(
				200
			);
		}
		expect((await POST(request({ email: 'a@b.com' }, { ip }))).status).toBe(
			429
		);
	});
});
