import { describe, expect, it } from 'vitest';
import { buildSignInCodeEmail } from './sign-in-email';

describe('buildSignInCodeEmail', () => {
	it('puts the code in the subject, so it reads off a phone notification', async () => {
		expect((await buildSignInCodeEmail('042917', 'en')).subject).toBe(
			'Your Blackwater RC sign-in code: 042917'
		);
		expect((await buildSignInCodeEmail('042917', 'zh_tw')).subject).toBe(
			'您的 Blackwater RC 登入驗證碼：042917'
		);
	});

	it('keeps leading zeros and carries the code in both bodies', async () => {
		const email = await buildSignInCodeEmail('000123', 'en');
		expect(email.text).toContain('000123');
		// One text run, so a member selecting it copies exactly the code.
		expect(email.html).toContain('<strong>000123</strong>');
	});

	it('escapes the copy it puts into HTML', async () => {
		// The English strings carry apostrophes ("didn't").
		const { html } = await buildSignInCodeEmail('123456', 'en');
		expect(html).not.toContain("didn't");
		expect(html).toContain('didn&#x27;t');
	});

	it('loads the wordmark as an absolute PNG from the site', async () => {
		// SITE_URL is the suite's sentinel host (vitest.config.ts).
		const { html } = await buildSignInCodeEmail('123456', 'en');
		expect(html).toContain(
			'src="https://example.test/blackwater_wordmark_RGB_blkwtr_wordmark_white.png"'
		);
	});

	it('sets the document language from the locale', async () => {
		const { html } = await buildSignInCodeEmail('123456', 'zh_tw');
		expect(html).toContain('lang="zh-TW"');
		expect(html).toContain('10 分鐘內有效');
	});
});
