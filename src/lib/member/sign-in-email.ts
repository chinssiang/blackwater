import 'server-only';
import { interpolate } from '@/lib/dictionary';
import type { Locale } from '@/lib/i18n';
import { escapeHtml } from '@/lib/utils';

// Copy lives here, not in src/dictionaries/, because the dictionaries are
// bundled into the client and this is server-only content -- the same rule
// product-submission's confirmation-email.ts follows.
const COPY = {
	en: {
		subject: 'Your Blackwater RC sign-in code: {code}',
		intro: 'Here is your code to sign in to Blackwater RC:',
		expiry: 'It works for 10 minutes.',
		ignore:
			"If you didn't ask to sign in, you can ignore this email. No one can sign in without the code.",
	},
	zh_tw: {
		subject: '您的 Blackwater RC 登入驗證碼：{code}',
		intro: '這是您登入 Blackwater RC 的驗證碼：',
		expiry: '10 分鐘內有效。',
		ignore:
			'如果您沒有要求登入，可以忽略這封信。沒有驗證碼，任何人都無法登入。',
	},
} satisfies Record<Locale, Record<string, string>>;

/**
 * The code sits in the subject as well as the body on purpose: most members
 * read the site on a phone, and a code in the subject is readable straight
 * off the notification without leaving the page they are signing in on.
 */
export function buildSignInCodeEmail(code: string, locale: Locale) {
	const t = COPY[locale];
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
 * (Gmail by default), so all three share its daily cap -- about 500 for a
 * personal Gmail, 2,000 for Workspace. The transport settings are repeated in
 * those two routes as well, so changing provider means changing all three.
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
	// Loaded here rather than at the top: /account imports this module through
	// the auth config, and that page never sends mail.
	const { default: nodemailer } = await import('nodemailer');
	const transporter = nodemailer.createTransport({
		host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
		port: Number(process.env.EMAIL_SERVER_PORT) || 465,
		secure: true,
		auth: { user, pass },
	});
	await transporter.sendMail({
		from: `"${process.env.EMAIL_DISPLAY_NAME || 'Blackwater RC'}" <${user}>`,
		to: email,
		...buildSignInCodeEmail(code, locale),
	});
}
