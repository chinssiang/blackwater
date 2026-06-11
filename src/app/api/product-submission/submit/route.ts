import { NextResponse, NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import * as z from 'zod';
import { client } from '@/sanity/lib/client';
import { productSubmissionConfigQuery } from '@/sanity/lib/queries';
import { urlForImage } from '@/sanity/lib/image';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';
import { buildConfirmationEmail, escapeHtml } from './confirmation-email';

// The recipient, subject, and all template content are resolved server-side
// (from Sanity + built-in defaults) so this endpoint can't be used to relay
// arbitrary mail — the client only supplies the submitted form values.
const bodySchema = z.object({
	formData: z.object({
		name: z.string().trim().min(1).max(200),
		email: z.string().trim().email().max(320),
		productUrl: z
			.string()
			.trim()
			.max(2000)
			.refine((value) => /^https?:\/\//i.test(value) && URL.canParse(value)),
	}),
});

// Best-effort per-IP throttle. In-memory, so it's per server instance —
// not airtight, but enough to stop naive scripted abuse of an endpoint
// that sends email to a caller-supplied address.
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
			{ status: 'error', message: 'Invalid submission.' },
			{ status: 400 }
		);
	}
	const { formData } = parsed.data;
	const rawLocale = (body as { locale?: unknown }).locale;
	const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

	const authUser = process.env.EMAIL_SERVER_USER;
	const authPassword = process.env.EMAIL_SERVER_PASSWORD;
	const emailFrom = process.env.EMAIL_DISPLAY_NAME;
	const siteUrl = process.env.SITE_URL || 'https://blackwaterrc.com';

	let config;
	try {
		config = await client.fetch(
			productSubmissionConfigQuery,
			{ locale },
			{ stega: false }
		);
	} catch (err) {
		console.error('[product-submission] failed to fetch config', err);
		return NextResponse.json(
			{ status: 'error', message: 'Failed to send email. Please try again.' },
			{ status: 500 }
		);
	}
	if (!config?.recipient) {
		console.error(
			'[product-submission] no submissionEmail configured on pProductIndex'
		);
		return NextResponse.json(
			{ status: 'error', message: 'Submissions are not configured.' },
			{ status: 500 }
		);
	}

	const transporter = nodemailer.createTransport({
		host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
		port: Number(process.env.EMAIL_SERVER_PORT) || 465,
		secure: true, // true for 465, false for other ports
		auth: {
			user: authUser,
			pass: authPassword,
		},
	});

	// Owner notification is the submission itself — if it fails, the whole
	// request fails so the form shows its error state.
	try {
		const ownerHtml = [
			['Name', formData.name],
			['Email', formData.email],
			['Product URL', formData.productUrl],
		]
			.map(([label, value]) => `${label}: ${escapeHtml(value)}`)
			.join('<br />');
		await transporter.sendMail({
			from: `"${emailFrom}" <${authUser}>`,
			to: config.recipient,
			replyTo: formData.email,
			subject: `Product Submission [${formData.name}]`,
			html: ownerHtml,
		});
	} catch (err) {
		console.error('[product-submission]', err);
		return NextResponse.json(
			{ status: 'error', message: 'Failed to send email. Please try again.' },
			{ status: 500 }
		);
	}

	// Confirmation to the submitter is a courtesy — never fail the request
	// over it (the submission already reached the owner; failing here would
	// cause duplicate owner emails on retry).
	try {
		const logoUrl = config.logo?.asset
			? urlForImage(config.logo).width(280).format('png').url()
			: null;
		const { subject, html, text } = buildConfirmationEmail({
			template: {
				subject: config.subject,
				heading: config.heading,
				message: config.message,
				footer: config.footer,
				logoUrl,
			},
			locale,
			submission: formData,
			siteUrl,
		});
		await transporter.sendMail({
			from: `"${emailFrom}" <${authUser}>`,
			to: formData.email,
			replyTo: config.recipient,
			subject,
			html,
			text,
		});
	} catch (err) {
		console.error('[product-submission] confirmation email failed', err);
	}

	return Response.json({ ok: true });
}
