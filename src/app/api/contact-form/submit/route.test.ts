import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the options passed to sendMail so we can assert on the built subject.
const sendMail = vi.fn(async (opts: Record<string, unknown>) => opts);

vi.mock('nodemailer', () => ({
	default: {
		createTransport: () => ({ sendMail }),
	},
}));

// The recipient is resolved server-side so a caller cannot name it; that read is
// the thing to stub.
const fetchConfig = vi.fn();
vi.mock('@/sanity/lib/client', () => ({
	client: { fetch: (...args: unknown[]) => fetchConfig(...args) },
}));

const { POST } = await import('./route');

// The throttle is module-level and keyed by IP, so every request needs its own
// or the sixth call in the file inherits the fifth test's budget.
let ipCounter = 0;

function request({
	body = { formData: { name: 'Bob', email: 'bob@x.com' } },
	ip = `10.0.0.${++ipCounter}`,
	json,
}: {
	body?: unknown;
	ip?: string;
	json?: () => Promise<unknown>;
} = {}): NextRequest {
	return {
		headers: new Headers({ 'x-forwarded-for': ip }),
		json: json ?? (async () => body),
	} as unknown as NextRequest;
}

beforeEach(() => {
	fetchConfig.mockResolvedValue({
		recipient: 'to@x.com',
		subject: 'New enquiry',
	});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	sendMail.mockClear();
	fetchConfig.mockReset();
	vi.restoreAllMocks();
});

describe('contact-form POST', () => {
	it('sends to the CMS recipient, ignoring any the caller supplies', async () => {
		const res = await POST(
			request({
				body: {
					// An attacker-supplied recipient must not be honoured.
					sendToEmail: 'victim@example.com',
					formData: { name: 'Bob', email: 'bob@x.com' },
				},
			})
		);
		expect(res.status).toBe(200);
		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(sendMail.mock.calls[0][0].to).toBe('to@x.com');
	});

	it('appends the sender name in brackets when present', async () => {
		await POST(request());
		expect(sendMail.mock.calls[0][0].subject).toBe('New enquiry [Bob]');
	});

	it('does not render "false" when the name is absent', async () => {
		await POST(request({ body: { formData: { email: 'bob@x.com' } } }));
		expect(sendMail.mock.calls[0][0].subject).toBe('New enquiry');
	});

	it('uses a valid form email as replyTo, falling back to the recipient', async () => {
		await POST(request({ body: { formData: { email: 'bob@x.com' } } }));
		expect(sendMail.mock.calls[0][0].replyTo).toBe('bob@x.com');

		await POST(request({ body: { formData: { email: 'not-an-email' } } }));
		expect(sendMail.mock.calls[1][0].replyTo).toBe('to@x.com');
	});

	it('escapes submitted values in the HTML body', async () => {
		await POST(
			request({
				body: {
					formData: {
						message: "<a href='https://phish.example'>Reset</a>",
					},
				},
			})
		);
		const html = sendMail.mock.calls[0][0].html as string;
		expect(html).not.toContain('<a href');
		expect(html).toContain('&lt;a href=&#39;https://phish.example&#39;&gt;');
	});

	it('rejects a body that is not JSON with 400', async () => {
		const res = await POST(
			request({
				json: async () => {
					throw new Error('bad json');
				},
			})
		);
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toMatchObject({ status: 'error' });
		expect(sendMail).not.toHaveBeenCalled();
	});

	it('rejects a submission whose formData is not an object', async () => {
		const res = await POST(request({ body: { formData: 'nope' } }));
		expect(res.status).toBe(400);
		expect(sendMail).not.toHaveBeenCalled();
	});

	it('returns 500 when no recipient is configured', async () => {
		fetchConfig.mockResolvedValue({ recipient: null, subject: null });
		const res = await POST(request());
		expect(res.status).toBe(500);
		expect(sendMail).not.toHaveBeenCalled();
	});

	it('returns 500 when the config read fails', async () => {
		fetchConfig.mockRejectedValue(new Error('sanity down'));
		expect((await POST(request())).status).toBe(500);
		expect(sendMail).not.toHaveBeenCalled();
	});

	it('returns 500 when delivery fails', async () => {
		sendMail.mockRejectedValueOnce(new Error('smtp down'));
		const res = await POST(request());
		expect(res.status).toBe(500);
		await expect(res.json()).resolves.toMatchObject({ status: 'error' });
	});

	it('throttles a single IP after five submissions', async () => {
		const ip = '10.9.9.9';
		for (let i = 0; i < 5; i++) {
			expect((await POST(request({ ip }))).status).toBe(200);
		}
		expect((await POST(request({ ip }))).status).toBe(429);
	});
});
