import { NextResponse, NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import * as z from 'zod';
import { client } from '@/sanity/lib/client';
import { contactFormConfigQuery } from '@/sanity/lib/queries';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';
import { formatObjectToHtml } from '@/lib/utils';

// The recipient and subject are resolved server-side (from pContact) so this
// endpoint can't be used to relay arbitrary mail — the client only supplies the
// submitted form values. The fields themselves are author-defined in the Studio
// form builder, so the schema constrains their shape rather than their names.
const bodySchema = z.object({
	formData: z.record(
		z.string().max(100),
		z.union([z.string().max(5000), z.number(), z.boolean(), z.null()])
	),
});

// Best-effort per-IP throttle. In-memory, so it's per server instance — not
// airtight, but enough to stop naive scripted abuse of an endpoint that sends
// email.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const submissionTimes = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
	if (submissionTimes.size > 10_000) submissionTimes.clear();
	const now = Date.now();
	const recent = (submissionTimes.get(ip) ?? []).filter(
		(t) => now - t < RATE_WINDOW_MS
	);
	if (recent.length >= RATE_LIMIT) {
		submissionTimes.set(ip, recent);
		return true;
	}
	recent.push(now);
	submissionTimes.set(ip, recent);
	return false;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
	const ip =
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		req.headers.get('x-real-ip') ||
		'unknown';
	if (isRateLimited(ip)) {
		return NextResponse.json(
			{ status: 'error', message: 'Too many submissions. Try again later.' },
			{ status: 429 }
		);
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json(
			{ status: 'error', message: 'Invalid request body.' },
			{ status: 400 }
		);
	}

	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ status: 'error', message: 'Invalid form submission.' },
			{ status: 400 }
		);
	}
	const { formData } = parsed.data;
	const rawLocale = (body as { locale?: unknown }).locale;
	const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

	// Read server-side (stega off) so the client can't override the recipient and
	// a draft-mode render can't leak stega characters into the address.
	let recipient: string | null | undefined;
	let subject: string | null | undefined;
	try {
		const config = await client.fetch(
			contactFormConfigQuery,
			{ locale },
			{ stega: false }
		);
		recipient = config.recipient;
		subject = config.subject;
	} catch (err) {
		console.error('[contact-form] failed to fetch config', err);
		return NextResponse.json(
			{ status: 'error', message: 'Server configuration error.' },
			{ status: 500 }
		);
	}
	if (!recipient) {
		console.error('[contact-form] no pContact.contactForm.sendToEmail', locale);
		return NextResponse.json(
			{ status: 'error', message: 'Contact form is not configured.' },
			{ status: 500 }
		);
	}

	const authUser = process.env.EMAIL_SERVER_USER;
	const authPassword = process.env.EMAIL_SERVER_PASSWORD;
	const emailFrom = process.env.EMAIL_DISPLAY_NAME;

	try {
		const transporter = nodemailer.createTransport({
			host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
			port: Number(process.env.EMAIL_SERVER_PORT) || 465,
			secure: true, // true for 465, false for other ports
			auth: {
				user: authUser,
				pass: authPassword,
			},
		});
		// Reply-To is the one place a submitted value reaches a mail header, and
		// only after it parses as an address — so it cannot carry a header break.
		const submittedEmail =
			typeof formData.email === 'string' ? formData.email.trim() : '';
		const replyTo = EMAIL_REGEX.test(submittedEmail)
			? submittedEmail
			: recipient;
		const submittedName =
			typeof formData.name === 'string' ? formData.name.trim() : '';
		const mailOptions = {
			from: `"${emailFrom}" <${authUser}>`,
			to: recipient,
			replyTo,
			subject: `${subject ?? 'New enquiry'}${submittedName ? ` [${submittedName}]` : ''}`,
			html: formatObjectToHtml(formData),
		};

		const info = await transporter.sendMail(mailOptions);
		return Response.json(info);
	} catch (err) {
		console.error('[contact-form]', err);
		return NextResponse.json(
			{ status: 'error', message: 'Failed to send email. Please try again.' },
			{ status: 500 }
		);
	}
}
