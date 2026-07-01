import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST } from './route';

function request(body: unknown): NextRequest {
	return { json: async () => body } as unknown as NextRequest;
}

const ORIGINAL_KEY = process.env.KLAVIYO_PRIVATE_API_KEY;

beforeEach(() => {
	process.env.KLAVIYO_PRIVATE_API_KEY = 'pk_test';
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	process.env.KLAVIYO_PRIVATE_API_KEY = ORIGINAL_KEY;
	vi.restoreAllMocks();
});

describe('newsletter subscribe POST', () => {
	it('rejects an invalid email with 400', async () => {
		const res = await POST(request({ email: 'nope', listId: 'L1' }));
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toMatchObject({ ok: false });
	});

	it('rejects a missing listId with 400', async () => {
		const res = await POST(request({ email: 'a@b.com' }));
		expect(res.status).toBe(400);
	});

	it('returns 500 when the API key is not configured', async () => {
		delete process.env.KLAVIYO_PRIVATE_API_KEY;
		const res = await POST(request({ email: 'a@b.com', listId: 'L1' }));
		expect(res.status).toBe(500);
	});

	it('calls Klaviyo and returns ok on success', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 200 }));
		const res = await POST(request({ email: 'a@b.com', listId: 'L1' }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ ok: true });

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
	});

	it('surfaces a Klaviyo error as 502', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response('boom', { status: 400 })
		);
		const res = await POST(request({ email: 'a@b.com', listId: 'L1' }));
		expect(res.status).toBe(502);
	});

	it('returns 500 when the fetch throws', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
		const res = await POST(request({ email: 'a@b.com', listId: 'L1' }));
		expect(res.status).toBe(500);
	});
});
