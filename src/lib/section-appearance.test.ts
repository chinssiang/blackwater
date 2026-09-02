import { describe, expect, it } from 'vitest';
import { resolveSectionAppearance } from './section-appearance';
import { findHeadingHeroKey, heroHeading } from './page-modules';

const color = (r: number, g: number, b: number, a = 1) => ({
	hex: '#000000',
	rgb: { r, g, b, a },
});
const WHITE = color(255, 255, 255);
const BLACK = color(0, 0, 0);

// Draft mode appends invisible stega characters to string values; this is what
// reaches the component in the Presentation preview.
const stega = (value: string) => `${value}​​‌​`;

describe('resolveSectionAppearance', () => {
	it('falls back to the defaults when there is no appearance object', () => {
		const r = resolveSectionAppearance(undefined);
		expect(r.alignClass).toBe('text-left');
		expect(r.maxWidthClass).toBe('w-full');
		expect(r.inkCss).toBeUndefined();
		expect(r.paperCss).toBeUndefined();
	});

	it('treats null like an absent object', () => {
		expect(resolveSectionAppearance(null).maxWidthClass).toBe('w-full');
	});

	it('maps every max-width the schema offers', () => {
		const cases = {
			none: 'w-full',
			xl: 'max-w-7xl',
			l: 'max-w-5xl',
			m: 'max-w-3xl',
			s: 'max-w-xl',
			xs: 'max-w-xs',
		} as const;
		for (const [maxWidth, expected] of Object.entries(cases)) {
			expect(resolveSectionAppearance({ maxWidth }).maxWidthClass).toBe(
				expected
			);
		}
	});

	it('falls back on a cleared max-width rather than emitting no class', () => {
		// `??` would pass '' straight through, leaving the section unconstrained.
		expect(resolveSectionAppearance({ maxWidth: '' }).maxWidthClass).toBe(
			'w-full'
		);
	});

	it('falls back on a max-width key the schema no longer emits', () => {
		// FaqBlock's old 'md'/'lg' vocabulary still sits in older documents.
		expect(resolveSectionAppearance({ maxWidth: 'md' }).maxWidthClass).toBe(
			'w-full'
		);
	});

	it('survives stega-encoded values in draft mode', () => {
		const r = resolveSectionAppearance({
			textAlign: stega('text-center'),
			maxWidth: stega('m'),
		});
		expect(r.alignClass).toBe('text-center');
		expect(r.maxWidthClass).toBe('max-w-3xl');
	});

	it('refuses an unrecognised alignment instead of emitting it as a class', () => {
		expect(
			resolveSectionAppearance({ textAlign: 'definitely-not-a-class' })
				.alignClass
		).toBe('text-left');
	});

	it('keeps the authored text colour as-is', () => {
		const r = resolveSectionAppearance({ textColor: BLACK });
		expect(r.inkCss).toBe('rgba(0, 0, 0, 1)');
		expect(r.paperCss).toBeUndefined();
	});

	it('derives a legible ink when only a background is set', () => {
		// The regression this guards: the theme is dark-only, so leaving
		// --foreground alone put near-white text on an authored white section.
		const r = resolveSectionAppearance({ backgroundColor: WHITE });
		expect(r.paperCss).toBe('rgba(255, 255, 255, 1)');
		expect(r.inkCss).toBe('rgb(23, 23, 23)');
	});

	it('derives a light ink over a dark authored background', () => {
		expect(resolveSectionAppearance({ backgroundColor: BLACK }).inkCss).toBe(
			'rgb(245, 245, 245)'
		);
	});

	it('does not override an authored text colour with the derived one', () => {
		const r = resolveSectionAppearance({
			backgroundColor: WHITE,
			textColor: color(10, 10, 10),
		});
		expect(r.inkCss).toBe('rgba(10, 10, 10, 1)');
	});

	it('passes spacing through as raw scale steps, preserving 0', () => {
		const r = resolveSectionAppearance({
			spacingTop: 0,
			spacingBottom: 24,
			spacingTopDesktop: null,
		});
		// 0 is an authored choice and must survive; only absent values default.
		expect(r.spacing.pt).toBe(0);
		expect(r.spacing.pb).toBe(24);
		expect(r.spacing.ptSm).toBe(12);
		expect(r.spacing.pbSm).toBe(12);
	});

	// The Studio's initialValue only fires for newly created array items, so
	// content already in a dataset arrives with no spacing at all. Without these
	// the section-spacing utility falls through to 0 and the section has no
	// padding, which is not what the schema tells the editor the default is.
	it('defaults absent spacing to the same steps the schema offers', () => {
		const r = resolveSectionAppearance({});
		expect(r.spacing.pt).toBe(9);
		expect(r.spacing.pb).toBe(9);
		expect(r.spacing.ptSm).toBe(12);
		expect(r.spacing.pbSm).toBe(12);
	});
});

describe('findHeadingHeroKey', () => {
	const hero = (key: string, heading?: string | null) => ({
		_type: 'heroBlock',
		_key: key,
		heading,
	});
	const other = (key: string) => ({ _type: 'freeform', _key: key });

	it('returns null when there are no modules', () => {
		expect(findHeadingHeroKey(undefined)).toBeNull();
		expect(findHeadingHeroKey([])).toBeNull();
	});

	it('ignores a hero an editor added but never filled in', () => {
		// The regression this guards: an empty hero used to suppress the
		// landingTitle fallback while rendering nothing itself.
		expect(findHeadingHeroKey([hero('a')])).toBeNull();
		expect(findHeadingHeroKey([hero('a', '')])).toBeNull();
		expect(findHeadingHeroKey([hero('a', '   ')])).toBeNull();
	});

	it('finds a hero that is not in the first slot', () => {
		expect(findHeadingHeroKey([other('x'), hero('a', 'Hello')])).toBe('a');
	});

	it('picks the first hero carrying a heading', () => {
		expect(findHeadingHeroKey([hero('a'), hero('b', 'Real')])).toBe('b');
	});

	it('ignores non-hero modules that happen to have a heading', () => {
		expect(
			findHeadingHeroKey([
				{ _type: 'productsBlock', _key: 'p', heading: 'Kit' },
			])
		).toBeNull();
	});

	it('sees through stega encoding on the heading', () => {
		expect(findHeadingHeroKey([hero('a', stega('Hello'))])).toBe('a');
	});
});

describe('heroHeading', () => {
	it('returns null for anything that is not a hero', () => {
		expect(heroHeading({ _type: 'freeform', heading: 'x' })).toBeNull();
		expect(heroHeading(null)).toBeNull();
	});

	it('returns the trimmed heading', () => {
		expect(heroHeading({ _type: 'heroBlock', heading: '  Hi  ' })).toBe('Hi');
	});
});
