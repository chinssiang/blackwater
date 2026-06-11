import { htmlLangFor, localePrefix, type Locale } from '@/lib/i18n';

// Confirmation email sent to the visitor after a product submission.
// CMS copy comes from pProductIndex.confirmationEmail (per-field English
// fallback resolved in GROQ); any field still empty uses these defaults.
// Copy lives here, not in src/dictionaries/, because the dictionaries are
// bundled into the client and this is server-only content.
const DEFAULT_TEMPLATES: Record<
	Locale,
	{ subject: string; heading: string; message: string; footer: string }
> = {
	en: {
		subject: 'We received your product submission',
		heading: 'Thanks, {{name}}!',
		message:
			"We've received your product submission and will take a look shortly.\n\nHere's a copy of what you sent us.",
		footer: "You're receiving this email because you submitted a product on our site.",
	},
	zh_tw: {
		subject: '我們已收到您的商品推薦',
		heading: '{{name}}，謝謝您！',
		message: '我們已收到您的商品推薦，將儘快查看。\n\n以下是您提交的內容。',
		footer: '您會收到這封信，是因為您在我們網站上推薦了商品。',
	},
};

const DETAIL_LABELS: Record<
	Locale,
	{ name: string; email: string; productUrl: string }
> = {
	en: { name: 'Full name', email: 'Email', productUrl: 'Product URL' },
	zh_tw: { name: '姓名', email: '電子郵件', productUrl: '商品網址' },
};

const FONT_STACK = 'Helvetica, Arial, sans-serif';
const COLOR_BG = '#F5F5F5';
const COLOR_TEXT = '#252525';
const COLOR_MUTED = '#6F6F6F';
const COLOR_FAINT = '#8A8A8A';
const COLOR_BORDER = '#EBE9E9';
const COLOR_ACCENT = '#6B5FFF';

export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

const NAME_TOKEN = /\{\{\s*name\s*\}\}/g;

// Split CMS text into paragraphs on blank lines; keep single line breaks.
// Input must already be HTML-escaped.
function paragraphsToHtml(escapedText: string): string {
	return escapedText
		.replace(/\r\n/g, '\n')
		.split(/\n{2,}/)
		.map(
			(paragraph) =>
				`<p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${COLOR_TEXT};">${paragraph.replaceAll('\n', '<br />')}</p>`
		)
		.join('');
}

export function buildConfirmationEmail({
	template,
	locale,
	submission,
	siteUrl,
}: {
	template: {
		subject?: string | null;
		heading?: string | null;
		message?: string | null;
		footer?: string | null;
		logoUrl?: string | null;
	};
	locale: Locale;
	submission: { name: string; email: string; productUrl: string };
	siteUrl: string;
}): { subject: string; html: string; text: string } {
	const defaults = DEFAULT_TEMPLATES[locale];
	const labels = DETAIL_LABELS[locale];
	const subjectTemplate = template.subject?.trim() || defaults.subject;
	const headingTemplate = template.heading?.trim() || defaults.heading;
	const messageTemplate = template.message?.trim() || defaults.message;
	const footerText = template.footer?.trim() || defaults.footer;
	const logoUrl =
		template.logoUrl ||
		`${siteUrl}/blackwater_wordmark_RGB_blkwtr_wordmark_black.png`;
	const siteHref = `${siteUrl}${localePrefix(locale)}`;

	// Replacer functions keep the name literal — a plain string replacement
	// would expand $-patterns ($&, $') occurring in user input.
	// Subject is a mail header, not HTML — substitute the raw name.
	const subject = subjectTemplate.replace(NAME_TOKEN, () => submission.name);

	const escapedName = escapeHtml(submission.name);
	const heading = escapeHtml(headingTemplate).replace(
		NAME_TOKEN,
		() => escapedName
	);
	const message = escapeHtml(messageTemplate).replace(
		NAME_TOKEN,
		() => escapedName
	);
	const preheader = message.replace(/\r\n/g, '\n').split('\n')[0];

	const details: { label: string; valueHtml: string; valueText: string }[] = [
		{
			label: labels.name,
			valueHtml: escapedName,
			valueText: submission.name,
		},
		{
			label: labels.email,
			valueHtml: escapeHtml(submission.email),
			valueText: submission.email,
		},
		{
			label: labels.productUrl,
			// Deliberately not a clickable link: the recipient address is
			// caller-supplied, so a live link would let this endpoint be
			// abused to deliver branded phishing links to arbitrary inboxes.
			valueHtml: `<span style="word-break:break-all;">${escapeHtml(submission.productUrl)}</span>`,
			valueText: submission.productUrl,
		},
	];

	const detailRowsHtml = details
		.map(
			({ label, valueHtml }, i) => `
								<tr>
									<td style="padding:${i === 0 ? '16px' : '12px'} 16px 0;font-family:${FONT_STACK};font-size:12px;line-height:1.4;color:${COLOR_MUTED};">${escapeHtml(label)}</td>
								</tr>
								<tr>
									<td style="padding:2px 16px ${i === details.length - 1 ? '16px' : '0'};font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:${COLOR_TEXT};">${valueHtml}</td>
								</tr>`
		)
		.join('');

	const html = `<!DOCTYPE html>
<html lang="${htmlLangFor(locale)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
</head>
<body style="margin:0;padding:0;background-color:${COLOR_BG};">
	<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR_BG}" style="background-color:${COLOR_BG};">
		<tr>
			<td align="center" style="padding:32px 16px;">
				<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">
					<tr>
						<td style="padding-bottom:24px;">
							<a href="${siteHref}" target="_blank" style="text-decoration:none;">
								<img src="${escapeHtml(logoUrl)}" width="140" alt="Blackwater RC" style="display:block;border:0;height:auto;" />
							</a>
						</td>
					</tr>
					<tr>
						<td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid ${COLOR_BORDER};border-radius:8px;padding:32px;">
							<h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:20px;font-weight:700;line-height:1.3;color:${COLOR_TEXT};">${heading}</h1>
							${paragraphsToHtml(message)}
							<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR_BG}" style="background-color:${COLOR_BG};border:1px solid ${COLOR_BORDER};border-radius:6px;margin-top:12px;">${detailRowsHtml}
							</table>
						</td>
					</tr>
					<tr>
						<td align="center" style="padding-top:24px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${COLOR_FAINT};">
							${escapeHtml(footerText)}<br />
							<a href="${siteHref}" target="_blank" style="color:${COLOR_ACCENT};">${escapeHtml(siteUrl.replace(/^https?:\/\//, ''))}</a>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;

	const headingText = headingTemplate.replace(
		NAME_TOKEN,
		() => submission.name
	);
	const messageText = messageTemplate.replace(
		NAME_TOKEN,
		() => submission.name
	);
	const text = [
		headingText,
		'',
		messageText,
		'',
		...details.map(({ label, valueText }) => `${label}: ${valueText}`),
		'',
		footerText,
		siteHref,
	].join('\n');

	return { subject, html, text };
}
