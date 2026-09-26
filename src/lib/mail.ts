import 'server-only';

/**
 * The site's one SMTP account (Gmail by default), shared by the contact form,
 * product submissions and member sign-in codes -- so all three also share its
 * daily sending cap. Changing provider is a change here and to the
 * EMAIL_SERVER_* variables, nowhere else.
 *
 * `secure` follows the port: implicit TLS on 465, STARTTLS elsewhere (587).
 * It was hard-coded `true` in each copy this replaced, which fails outright on
 * a STARTTLS port. `requireTLS` makes STARTTLS mandatory: without it a server
 * reply stripped of STARTTLS sends the password and the mail in cleartext.
 *
 * nodemailer is imported on call, not at the top, so a route that only
 * sometimes sends mail does not load it on every cold start.
 */
export async function createMailTransport(auth: {
	user: string | undefined;
	pass: string | undefined;
}) {
	const { default: nodemailer } = await import('nodemailer');
	const port = Number(process.env.EMAIL_SERVER_PORT) || 465;
	return nodemailer.createTransport({
		host: process.env.EMAIL_SERVER_HOST || 'smtp.gmail.com',
		port,
		secure: port === 465,
		requireTLS: port !== 465,
		auth,
	});
}

/** Whether the account's credentials are set at all. The limit on what it
 *  accepts in a day is not knowable here. */
export function isMailConfigured() {
	return !!process.env.EMAIL_SERVER_USER && !!process.env.EMAIL_SERVER_PASSWORD;
}
