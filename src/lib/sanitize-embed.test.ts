import { describe, expect, it } from 'vitest';
import { sanitizeEmbedSnippet } from './sanitize-embed';

const YOUTUBE =
	'<iframe width="560" height="315" src="https://www.youtube.com/embed/abc123" title="A video" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';

describe('sanitizeEmbedSnippet', () => {
	it('returns an empty string for empty input', () => {
		expect(sanitizeEmbedSnippet('')).toBe('');
		expect(sanitizeEmbedSnippet(null)).toBe('');
		expect(sanitizeEmbedSnippet(undefined)).toBe('');
	});

	it('keeps a legitimate provider embed intact', () => {
		const result = sanitizeEmbedSnippet(YOUTUBE);
		expect(result).toContain('<iframe');
		expect(result).toContain('src="https://www.youtube.com/embed/abc123"');
		expect(result).toContain('allowfullscreen');
		expect(result).toContain('width="560"');
	});

	it('strips a tag that is not an iframe', () => {
		expect(sanitizeEmbedSnippet('<img src=x onerror=alert(1)>')).toBe('');
		expect(sanitizeEmbedSnippet('<svg onload=alert(1)></svg>')).toBe('');
		expect(sanitizeEmbedSnippet('<script>alert(1)</script>')).toBe('');
	});

	it('strips an event handler from an otherwise valid iframe', () => {
		const result = sanitizeEmbedSnippet(
			'<iframe src="https://example.com" onload="alert(1)"></iframe>'
		);
		expect(result).toContain('<iframe');
		expect(result).not.toContain('onload');
	});

	it('strips srcdoc, which is script execution in disguise', () => {
		const result = sanitizeEmbedSnippet(
			'<iframe srcdoc="<script>alert(1)</script>"></iframe>'
		);
		expect(result).not.toContain('srcdoc');
		expect(result).not.toContain('alert');
	});

	it('drops a non-https src rather than the whole element', () => {
		// sanitize-html removes the offending attribute, not the tag.
		expect(sanitizeEmbedSnippet('<iframe src="http://example.com"></iframe>'))
			.not.toContain('http://example.com');
		expect(
			sanitizeEmbedSnippet('<iframe src="javascript:alert(1)"></iframe>')
		).not.toContain('javascript:');
	});

	it('caps an oversized snippet', () => {
		// Plain text, deliberately: an input that sanitize-html strips to '' would
		// pass this assertion with the cap deleted. Text survives sanitization, so
		// the length assertion can only be satisfied by the slice.
		expect(sanitizeEmbedSnippet('a'.repeat(30_000))).toHaveLength(20_000);
	});
});
