import { vercelStegaCombine } from '@vercel/stega';
import { describe, expect, it } from 'vitest';
import {
	editorialBlockIsRenderable,
	resolveEditorialCta,
} from './editorial-block';

const VIMEO = 'https://vimeo.com/76979871';

describe('resolveEditorialCta', () => {
	it('needs a label', () => {
		expect(resolveEditorialCta({ vimeoUrl: VIMEO })).toBeNull();
		expect(resolveEditorialCta({ label: '', link: { href: '/x' } })).toBeNull();
	});

	it('needs a target it can open', () => {
		expect(resolveEditorialCta({ label: 'Go' })).toBeNull();
		// Not a Vimeo URL, so toVimeoEmbedUrl answers null and nothing plays.
		expect(
			resolveEditorialCta({ label: 'Go', vimeoUrl: 'https://youtube.com/1' })
		).toBeNull();
		// `href` arrives as `unknown` from GROQ; only a non-empty string counts.
		expect(resolveEditorialCta({ label: 'Go', link: { href: '' } })).toBeNull();
		expect(resolveEditorialCta({ label: 'Go', link: { href: 42 } })).toBeNull();
	});

	it('prefers a video over a link', () => {
		const cta = resolveEditorialCta({
			label: 'Watch',
			vimeoUrl: VIMEO,
			link: { href: '/about' },
		});
		expect(cta && 'video' in cta).toBe(true);
	});

	it('falls back to an uploaded file, keeping its type', () => {
		expect(
			resolveEditorialCta({
				label: 'Watch',
				videoFile: {
					url: 'https://cdn.sanity.io/f.mp4',
					mimeType: 'video/mp4',
				},
			})
		).toEqual({
			label: 'Watch',
			video: { fileUrl: 'https://cdn.sanity.io/f.mp4', mimeType: 'video/mp4' },
		});
	});

	it('resolves a link, defaulting to the same tab', () => {
		expect(
			resolveEditorialCta({ label: 'Read', link: { href: '/about' } })
		).toEqual({ label: 'Read', href: '/about', isNewTab: false });
	});
});

describe('editorialBlockIsRenderable', () => {
	it('is false for an empty block', () => {
		expect(editorialBlockIsRenderable({})).toBe(false);
	});

	it('ignores a blank or stega-only heading', () => {
		expect(editorialBlockIsRenderable({ heading: '   ' })).toBe(false);
		const encoded = vercelStegaCombine('', {
			origin: 'sanity.io',
			href: '/studio',
		});
		expect(editorialBlockIsRenderable({ heading: encoded })).toBe(false);
	});

	it('ignores an empty paragraph and a CTA with no target', () => {
		expect(
			editorialBlockIsRenderable({
				paragraph: [],
				callToAction: { label: 'Go' },
			})
		).toBe(false);
	});

	it('renders for any one real part', () => {
		expect(editorialBlockIsRenderable({ eyebrow: 'The crew' })).toBe(true);
		expect(editorialBlockIsRenderable({ heading: 'Run' })).toBe(true);
		expect(
			editorialBlockIsRenderable({ image: { image: { altText: 'x' } } })
		).toBe(true);
		expect(
			editorialBlockIsRenderable({
				callToAction: { label: 'Watch', vimeoUrl: VIMEO },
			})
		).toBe(true);
	});
});
