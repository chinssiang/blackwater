import { describe, expect, it } from 'vitest';
import { formatMemberName } from './name';

describe('formatMemberName', () => {
	it('puts the given name first for a Latin-script name', () => {
		expect(formatMemberName('Hsiang', 'Chin')).toBe('Hsiang Chin');
	});

	it('puts the family name first, unspaced, for a Chinese name', () => {
		expect(formatMemberName('小明', '陳')).toBe('陳小明');
	});

	it('counts the kana marks ー and ・ as part of a Japanese name', () => {
		expect(formatMemberName('ユーリ', '佐藤')).toBe('佐藤ユーリ');
		expect(formatMemberName('マリア・テレサ', '佐藤')).toBe(
			'佐藤マリア・テレサ'
		);
	});

	it('keeps the given-name-first order when the scripts are mixed', () => {
		expect(formatMemberName('Ming', '陳')).toBe('Ming 陳');
	});

	it('returns whichever part is set when only one is', () => {
		expect(formatMemberName('', 'Chin')).toBe('Chin');
		expect(formatMemberName('小明', '')).toBe('小明');
	});

	it('returns an empty string when neither part is set', () => {
		expect(formatMemberName('', '')).toBe('');
	});
});
