import 'server-only';
import { type Dictionary, interpolate } from '@/lib/dictionary';
import { getDictionary } from '@/lib/dictionary.server';
import type { Locale } from '@/lib/i18n';
import { escapeHtml } from '@/lib/utils';
import nodemailer from 'nodemailer';

/**
 * The code sits in the subject as well as the body on purpose: most members
 * read the site on a phone, and a code in the subject is readable straight
 * off the notification without leaving the page they are signing in on.
 */
export function buildSignInCodeEmail(
	code: string,
	t: Dictionary['account']['email']
) {
	return {
		subject: interpolate(t.subject, { code }),
		text: [t.intro, '', code, '', t.expiry, '', t.ignore].join('\n'),
		html: [
			`<p>${escapeHtml(t.intro)}</p>`,
			`<p style="font-size:28px;letter-spacing:6px;font-family:monospace"><strong>${escapeHtml(code)}</strong></p>`,
			`<p>${escapeHtml(t.expiry)}</p>`,
			`<p style="color:#666">${escapeHtml(t.ignore)}</p>`,
		].join(''),
	};
}

/**
 * Sends over the same SMTP account as the contact and product-submission forms
 * (Gmail by default). That account has a daily sending cap -- about 500 for a
 * personal Gmail, 2,000 for Workspace -- shared by all three, so a burst of
 * sign-ins can hold up contact-form mail. Swapping providers is a change to
 * this function only.
 */
export async function sendSignInCode({
	email,
	code,
	locale,
}: {
	email: string;
	code: string;
	locale: Locale;
}) {
	const user = process.env.EMAIL_SERVER_USER;
	const pass = process.env.EMAIL_SERVER_PASSWORD;
	if (!user || !pass) {
		throw new Error(
			'Missing environment variable: EMAIL_SERVER_USER / EMAIL_SERVER_PASSWORD'
		);
	}
	const { account } = await getDictionary(locale);
	const transporter = nodemailer.createTransport({
		host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
		port: Number(process.env.EMAIL_SERVER_PORT) || 465,
		secure: true,
		auth: { user, pass },
	});
	await transporter.sendMail({
		from: `"${process.env.EMAIL_DISPLAY_NAME || 'Blackwater RC'}" <${user}>`,
		to: email,
		...buildSignInCodeEmail(code, account.email),
	});
}
