import { describe, expect, it } from 'vitest';
import { buildConfirmationEmail, escapeHtml } from './confirmation-email';

describe('escapeHtml', () => {
	it('escapes all five HTML-sensitive characters', () => {
		expect(escapeHtml(`<a href="x" data-x='y'>&</a>`)).toBe(
			'&lt;a href=&quot;x&quot; data-x=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
		);
	});

	it('escapes ampersands before other entities (no double-escaping)', () => {
		expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;');
	});
});

const submission = {
	name: 'Bob',
	email: 'bob@example.com',
	productUrl: 'https://shop.example.com/item',
};
const siteUrl = 'https://blackwaterrc.com';

describe('buildConfirmationEmail', () => {
	it('falls back to locale defaults when template fields are blank', () => {
		const { subject, text } = buildConfirmationEmail({
			template: { subject: '  ', heading: null, message: '', footer: undefined },
			locale: 'en',
			submission,
			siteUrl,
		});
		expect(subject).toBe('We received your product submission');
		// {{name}} is interpolated in the default heading.
		expect(text).toContain('Thanks, Bob!');
	});

	it('uses zh_tw defaults and language tag', () => {
		const { subject, html } = buildConfirmationEmail({
			template: {},
			locale: 'zh_tw',
			submission,
			siteUrl,
		});
		expect(subject).toBe('我們已收到您的商品推薦');
		expect(html).toContain('<html lang="zh-TW">');
	});

	it('interpolates the {{name}} token in subject, heading and text', () => {
		const { subject, html, text } = buildConfirmationEmail({
			template: {
				subject: 'Hi {{ name }}',
				heading: 'Hello {{name}}',
				message: 'Body',
			},
			locale: 'en',
			submission,
			siteUrl,
		});
		expect(subject).toBe('Hi Bob');
		expect(html).toContain('Hello Bob');
		expect(text).toContain('Hello Bob');
	});

	it('escapes user input in the HTML body but keeps it raw in the subject', () => {
		const xss = {
			name: '<script>alert(1)</script>',
			email: 'x@y.com',
			productUrl: 'https://e.com/?a=1&b=2',
		};
		const { subject, html, text } = buildConfirmationEmail({
			template: { subject: 'Hi {{name}}', heading: 'Hi {{name}}' },
			locale: 'en',
			submission: xss,
			siteUrl,
		});
		// HTML body must not contain an unescaped script tag.
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('a=1&amp;b=2');
		// Subject is a mail header, substituted raw; plain-text part is raw too.
		expect(subject).toBe('Hi <script>alert(1)</script>');
		expect(text).toContain('https://e.com/?a=1&b=2');
	});

	it('does not render the product url as a clickable link', () => {
		const { html } = buildConfirmationEmail({
			template: {},
			locale: 'en',
			submission,
			siteUrl,
		});
		expect(html).not.toContain(`href="${submission.productUrl}"`);
		expect(html).toContain(submission.productUrl);
	});
});
