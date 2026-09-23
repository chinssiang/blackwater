import { vercelStegaCombine } from '@vercel/stega';
import { describe, expect, it } from 'vitest';
import { toVimeoEmbedUrl } from '@/lib/vimeo';

const EMBED = 'https://player.vimeo.com/video/76979871';
const PARAMS = 'autoplay=1&dnt=1';

describe('toVimeoEmbedUrl', () => {
	it('embeds a public share URL', () => {
		expect(toVimeoEmbedUrl('https://vimeo.com/76979871')).toBe(
			`${EMBED}?${PARAMS}`
		);
	});

	it('accepts the www host and a trailing slash', () => {
		expect(toVimeoEmbedUrl('https://www.vimeo.com/76979871/')).toBe(
			`${EMBED}?${PARAMS}`
		);
	});

	it('carries the privacy hash of an unlisted share URL', () => {
		expect(toVimeoEmbedUrl('https://vimeo.com/76979871/a1b2c3d4e5')).toBe(
			`${EMBED}?h=a1b2c3d4e5&${PARAMS}`
		);
	});

	it('accepts a player URL, keeping its hash', () => {
		expect(
			toVimeoEmbedUrl(
				'https://player.vimeo.com/video/76979871?h=a1b2c3d4e5&badge=0'
			)
		).toBe(`${EMBED}?h=a1b2c3d4e5&${PARAMS}`);
	});

	it('accepts a player URL with no hash', () => {
		expect(toVimeoEmbedUrl('https://player.vimeo.com/video/76979871')).toBe(
			`${EMBED}?${PARAMS}`
		);
	});

	it.each([
		["the owner's manage page", 'https://vimeo.com/manage/videos/76979871'],
		['a channel link', 'https://vimeo.com/channels/staffpicks/76979871'],
		['a group link', 'https://vimeo.com/groups/shortfilms/videos/76979871'],
		['a showcase video', 'https://vimeo.com/showcase/9876543/video/76979871'],
		['a paste with no scheme', 'vimeo.com/76979871'],
	])('finds the video in %s', (_label, value) => {
		expect(toVimeoEmbedUrl(value)).toBe(`${EMBED}?${PARAMS}`);
	});

	it('does not take a word after the id for a privacy hash', () => {
		expect(
			toVimeoEmbedUrl('https://vimeo.com/manage/videos/76979871/settings')
		).toBe(`${EMBED}?${PARAMS}`);
	});

	it('ignores surrounding whitespace', () => {
		expect(toVimeoEmbedUrl('  https://vimeo.com/76979871 ')).toBe(
			`${EMBED}?${PARAMS}`
		);
	});

	it('reads through draft-mode stega characters', () => {
		const encoded = vercelStegaCombine('https://vimeo.com/76979871', {
			origin: 'sanity.io',
			href: '/studio',
		});
		expect(toVimeoEmbedUrl(encoded)).toBe(`${EMBED}?${PARAMS}`);
	});

	it.each([
		['an empty value', ''],
		['nothing', undefined],
		['a YouTube URL', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
		['a lookalike host', 'https://vimeo.com.evil.test/76979871'],
		[
			'a Vimeo page that is not a video',
			'https://vimeo.com/channels/staffpicks',
		],
		[
			'a showcase rather than one of its videos',
			'https://vimeo.com/showcase/9876543',
		],
		['plain http', 'http://vimeo.com/76979871'],
		['not a URL', 'vimeo 76979871'],
	])('rejects %s', (_label, value) => {
		expect(toVimeoEmbedUrl(value)).toBeNull();
	});
});
