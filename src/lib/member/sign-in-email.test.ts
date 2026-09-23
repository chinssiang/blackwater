import { describe, expect, it } from 'vitest';
import { buildSignInCodeEmail } from './sign-in-email';

describe('buildSignInCodeEmail', () => {
	it('puts the code in the subject, so it reads off a phone notification', () => {
		expect(buildSignInCodeEmail('042917', 'en').subject).toBe(
			'Your Blackwater RC sign-in code: 042917'
		);
		expect(buildSignInCodeEmail('042917', 'zh_tw').subject).toBe(
			'您的 Blackwater RC 登入驗證碼：042917'
		);
	});

	it('keeps leading zeros and carries the code in both bodies', () => {
		const email = buildSignInCodeEmail('000123', 'en');
		expect(email.text).toContain('000123');
		expect(email.html).toContain('<strong>000123</strong>');
	});

	it('escapes the copy it puts into HTML', () => {
		// The English strings carry apostrophes ("didn't").
		const { html } = buildSignInCodeEmail('123456', 'en');
		expect(html).not.toContain("didn't");
		expect(html).toContain('didn&#39;t');
	});
});
