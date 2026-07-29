import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// Capture the options passed to sendMail so we can assert on the built subject.
const sendMail = vi.fn(async (opts: Record<string, unknown>) => opts);

vi.mock('nodemailer', () => ({
	default: {
		createTransport: () => ({ sendMail }),
	},
}));

import { POST } from './route';

function request(body: unknown): NextRequest {
	return { json: async () => body } as unknown as NextRequest;
}

afterEach(() => {
	sendMail.mockClear();
});

describe('contact-form POST subject line', () => {
	it('appends the sender name in brackets when present', async () => {
		await POST(
			request({
				sendToEmail: 'to@x.com',
				emailSubject: 'New enquiry',
				formData: { name: 'Bob', email: 'bob@x.com' },
			})
		);
		expect(sendMail).toHaveBeenCalledTimes(1);
		expect(sendMail.mock.calls[0][0].subject).toBe('New enquiry [Bob]');
	});

	it('does not render "false" when the name is absent', async () => {
		await POST(
			request({
				sendToEmail: 'to@x.com',
				emailSubject: 'New enquiry',
				formData: { email: 'bob@x.com' },
			})
		);
		expect(sendMail.mock.calls[0][0].subject).toBe('New enquiry');
	});

	it('uses a valid form email as replyTo, falling back to sendToEmail', async () => {
		await POST(
			request({
				sendToEmail: 'to@x.com',
				emailSubject: 'S',
				formData: { email: 'bob@x.com' },
			})
		);
		expect(sendMail.mock.calls[0][0].replyTo).toBe('bob@x.com');

		await POST(
			request({
				sendToEmail: 'to@x.com',
				emailSubject: 'S',
				formData: { email: 'not-an-email' },
			})
		);
		expect(sendMail.mock.calls[1][0].replyTo).toBe('to@x.com');
	});
});
