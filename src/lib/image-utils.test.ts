import { describe, expect, it } from 'vitest';
import {
	SANITY_IMAGE_QUALITY,
	buildSanityImageUrl,
	ensureAccessibleTextColor,
	hotspotObjectPosition,
	resolveRenderedRatio,
} from './image-utils';
import { readFile } from 'node:fs/promises';

// Same shape the status/brand-colour documents project: hex plus the rgb the
// contrast maths actually reads.
const color = (r: number, g: number, b: number, a = 1) => ({
	hex: '#000000',
	rgb: { r, g, b, a },
});

const WHITE = color(255, 255, 255);
const BLACK = color(0, 0, 0);
const LEGIBLE_DARK = 'rgb(23, 23, 23)';
const LEGIBLE_LIGHT = 'rgb(245, 245, 245)';

describe('ensureAccessibleTextColor', () => {
	describe('with a measurable authored background', () => {
		it('keeps the authored ink when it clears AA', () => {
			expect(ensureAccessibleTextColor(BLACK, WHITE)).toBe('rgba(0, 0, 0, 1)');
		});

		it('replaces the authored ink when it fails AA', () => {
			// Near-white on white: 1.07:1. The author's choice loses to legibility.
			expect(ensureAccessibleTextColor(color(238, 238, 238), WHITE)).toBe(
				LEGIBLE_DARK
			);
		});

		it('derives the better neutral when no ink is authored', () => {
			expect(ensureAccessibleTextColor(null, WHITE)).toBe(LEGIBLE_DARK);
			expect(ensureAccessibleTextColor(null, BLACK)).toBe(LEGIBLE_LIGHT);
		});

		it('honours alpha in the returned ink', () => {
			expect(ensureAccessibleTextColor(color(0, 0, 0, 0.5), WHITE)).toBe(
				'rgba(0, 0, 0, 0.5)'
			);
		});
	});

	// The regression this file was added for. There is no authored background in
	// these cases, but the callers still paint one (var(--muted)), so the ink
	// would be rendered against a surface this function cannot see: --muted is
	// resolved in the browser, differs per theme, and .section-paper overrides it
	// again. Passing the ink through meant it was never measured against what it
	// actually sat on.
	describe('with no measurable background', () => {
		it('returns false for any ink, because none of them can be checked', () => {
			// The live case: pEventStatus "By Invite Only" sets #eeeeee and no
			// background. That is 6.95:1 on the dark --muted but 1.06:1 on the
			// light one, so it cannot be honoured sight-unseen.
			expect(ensureAccessibleTextColor(color(238, 238, 238), null)).toBe(false);
			// Black ink is the opposite direction -- fine on the light --muted,
			// 2.2:1 on the dark one. Same verdict: neither is knowable here.
			expect(ensureAccessibleTextColor(BLACK, null)).toBe(false);
			// And with no ink at all there is nothing to return.
			expect(ensureAccessibleTextColor(null, null)).toBe(false);
			expect(ensureAccessibleTextColor(undefined, undefined)).toBe(false);
		});

		it('treats a background object with no rgb as unmeasurable', () => {
			// Typegen widens these derefs to `{} | Color | null`, so a colour
			// document can reach here without the channels the maths needs. No
			// cast: the helper accepts MaybeSanityColor and narrows internally.
			expect(ensureAccessibleTextColor(WHITE, { hex: '#505050' })).toBe(false);
		});
	});
});

// The URL shape is the whole pipeline now: `SanityImage`'s next/image `loader`
// calls buildSanityImageUrl once per srcset candidate, and the Sanity CDN is the
// only encoder in the path. Each assertion below is a bug that shipped; the
// measurements behind them are on buildSanityImageUrl itself, not repeated here.
const asset = (width = 1080, height = 1080) => ({
	_type: 'image' as const,
	asset: {
		_type: 'reference' as const,
		_ref: `image-abc123def456abc123def456abc123def456abcd-${width}x${height}-png`,
	},
});

const params = (url: string) => new URL(url).searchParams;

describe('buildSanityImageUrl', () => {
	it('emits no fm, so auto=format can still answer AVIF', () => {
		const p = params(buildSanityImageUrl(asset(), { width: 1080 }));
		expect(p.get('fm')).toBeNull();
		expect(p.get('auto')).toBe('format');
	});

	it('requests the width it is given, and defaults quality', () => {
		const p = params(buildSanityImageUrl(asset(), { width: 828 }));
		expect(p.get('w')).toBe('828');
		expect(p.get('q')).toBe(String(SANITY_IMAGE_QUALITY));
		expect(p.get('fit')).toBe('max');
	});

	it('honours an explicit quality', () => {
		expect(
			params(buildSanityImageUrl(asset(), { width: 640, quality: 95 })).get('q')
		).toBe('95');
	});

	it("carries the editor's crop into a rect", () => {
		const url = buildSanityImageUrl(
			{ ...asset(), crop: { top: 0.25, bottom: 0.25, left: 0, right: 0 } },
			{ width: 1080 }
		);
		expect(params(url).get('rect')).toBe('0,270,1080,540');
	});

	// Deliberately two DIFFERENT hotspots rather than one asserted rect. The
	// builder only consults the hotspot when it is given a height to crop to, so
	// an assertion on a single rect passes just as happily when the hotspot is
	// ignored entirely -- which is exactly how a regression that made it a no-op
	// once went unnoticed. What has to hold is that moving the hotspot moves the
	// rect.
	it('centres the rect on the hotspot when a cropRatio is given', () => {
		const rectFor = (y: number) =>
			params(
				buildSanityImageUrl(
					{ ...asset(), hotspot: { x: 0.5, y, width: 0.2, height: 0.2 } },
					{ width: 1080, cropRatio: 16 / 9 }
				)
			).get('rect');

		const high = rectFor(0.15);
		const low = rectFor(0.85);

		expect(high).not.toBeNull();
		expect(high).not.toBe(low);
		// 16:9 out of a square source: full width, 608 tall, sliding vertically.
		expect(high).toMatch(/^0,\d+,1080,608$/);
		expect(low).toMatch(/^0,\d+,1080,608$/);
		expect(Number(high!.split(',')[1])).toBeLessThan(
			Number(low!.split(',')[1])
		);
	});

	it('omits the height, and so the hotspot, when no cropRatio is given', () => {
		// The counterpart to the rule above: without a crop ratio there is no target
		// box to centre on, and the URL must not invent one.
		expect(
			params(buildSanityImageUrl(asset(), { width: 1080 })).get('h')
		).toBeNull();
		expect(
			params(
				buildSanityImageUrl(asset(), { width: 1080, cropRatio: 16 / 9 })
			).get('h')
		).toBe('608');
	});

	it('returns an empty string rather than throwing on a missing image', () => {
		expect(buildSanityImageUrl(null, { width: 1080 })).toBe('');
		expect(buildSanityImageUrl(undefined, { width: 1080 })).toBe('');
	});
});

// ImageBlock's <source> elements cannot go through next/image's `loader`, so it
// restates next/image's candidate widths as a literal. Nothing in the app checks
// the copy against the original -- if next's defaults ever move, <img> and
// <source> would quietly advertise different width sets. Importing the private
// path HERE rather than in the client component is the point: a breaking upgrade
// fails this test instead of shipping a silent divergence.
// The mobile hotspot override is a literal class (Tailwind emits only what it
// finds verbatim), so nothing but this ties its media query to the width the
// <source> elements switch at.
describe('ImageBlock MOBILE_MAX_WIDTH', () => {
	it('matches the media query in the mobile hotspot override', async () => {
		const source = await readFile(
			new URL('../components/ImageBlock.tsx', import.meta.url),
			'utf8'
		);
		const width = source.match(/const MOBILE_MAX_WIDTH = (\d+);/)?.[1];
		expect(width).toBeDefined();
		expect(source).toContain(`[@media(max-width:${width}px)]:`);
	});
});

describe('ImageBlock CANDIDATE_WIDTHS', () => {
	it("matches next/image's own default width lists", async () => {
		const { imageConfigDefault } =
			await import('next/dist/shared/lib/image-config');
		const source = await readFile(
			new URL('../components/ImageBlock.tsx', import.meta.url),
			'utf8'
		);
		const literal = source.match(
			/const CANDIDATE_WIDTHS = \[([\s\S]*?)\];/
		)?.[1];
		expect(literal).toBeDefined();

		const copied = literal!
			.split(',')
			.map((n) => n.trim())
			.filter(Boolean)
			.map(Number);

		expect(copied).toEqual(
			[
				...imageConfigDefault.imageSizes,
				...imageConfigDefault.deviceSizes,
			].sort((a, b) => a - b)
		);
	});
});

// What a caller's `height` attribute has to describe. Getting this from
// metadata.dimensions.aspectRatio alone is how a cropped image declares a box it
// does not fill, and the browser then squashes the bitmap into it.
describe('resolveRenderedRatio', () => {
	it('prefers an authored customRatio, which the CDN will crop to', () => {
		expect(resolveRenderedRatio(1, undefined, 16 / 9)).toBeCloseTo(16 / 9);
	});

	it('narrows the asset ratio by an authored crop', () => {
		// A square asset cropped 25% off the top and bottom is 2:1, not 1:1.
		expect(
			resolveRenderedRatio(1, { top: 0.25, bottom: 0.25, left: 0, right: 0 })
		).toBeCloseTo(2);
	});

	it('falls back to the asset ratio with no crop and no customRatio', () => {
		expect(resolveRenderedRatio(1.5)).toBe(1.5);
		expect(
			resolveRenderedRatio(1.5, { top: 0, bottom: 0, left: 0, right: 0 })
		).toBe(1.5);
	});

	it('has no answer when the asset has no dimensions', () => {
		expect(resolveRenderedRatio(undefined)).toBeUndefined();
		expect(resolveRenderedRatio(null)).toBeUndefined();
	});

	it('ignores a degenerate crop rather than dividing by zero', () => {
		expect(
			resolveRenderedRatio(1.5, { top: 0.5, bottom: 0.5, left: 0, right: 0 })
		).toBe(1.5);
	});
});

// `object-position` has to describe the hotspot inside the image the CDN
// DELIVERS, which is the authored crop -- and, with a customRatio, the
// hotspot-centred cut @sanity/image-url makes inside that crop.
describe('hotspotObjectPosition', () => {
	const NO_CROP = { top: 0, bottom: 0, left: 0, right: 0 };
	const spot = (x: number, y: number) => ({ x, y });

	it('has no answer without a hotspot', () => {
		expect(hotspotObjectPosition(1.5, NO_CROP, null)).toBeUndefined();
		expect(hotspotObjectPosition(1.5, NO_CROP, undefined)).toBeUndefined();
	});

	it('leaves a centred hotspot to the default', () => {
		expect(hotspotObjectPosition(1.5, NO_CROP, spot(0.5, 0.5))).toBeUndefined();
	});

	it('reads an uncropped hotspot as-is', () => {
		expect(hotspotObjectPosition(1.5, null, spot(0.2, 0.3))).toBe('20% 30%');
	});

	it('measures the hotspot inside the authored crop', () => {
		// The crop keeps x 0.2..1 and y 0..0.5: x 0.4 is a quarter of the way
		// across it and y 0.1 a fifth of the way down.
		expect(
			hotspotObjectPosition(
				1,
				{ top: 0, bottom: 0.5, left: 0.2, right: 0 },
				spot(0.4, 0.1)
			)
		).toBe('25% 20%');
	});

	it('follows the side cut a wide customRatio makes on a square asset', () => {
		// A 1:2 cut from a square keeps half the width, centred on x 0.3:
		// 0.05..0.55, so the hotspot lands in the middle of what is delivered.
		expect(hotspotObjectPosition(1, NO_CROP, spot(0.3, 0.8), 0.5)).toBe(
			'50% 80%'
		);
	});

	it('follows the top-and-bottom cut a wide customRatio makes', () => {
		// A 2:1 cut from a square keeps y 0.2..0.7 around a hotspot at y 0.45.
		expect(hotspotObjectPosition(1, NO_CROP, spot(0.1, 0.45), 2)).toBe(
			'10% 50%'
		);
	});

	it('keeps the cut inside the image when the hotspot hugs an edge', () => {
		// Centring a half-height cut on y 0.1 would start above the image, so the
		// builder pins it to y 0..0.5 and the hotspot sits a fifth of the way down.
		expect(hotspotObjectPosition(1, NO_CROP, spot(0.5, 0.1), 2)).toBe(
			'50% 20%'
		);
	});

	// The maths above repeats @sanity/image-url's private fit(). This holds it to
	// the real thing: the `rect=` the builder emits is the delivered bitmap, and
	// the hotspot measured inside that rect is what object-position must say. A
	// library upgrade that moves the window fails here rather than drifting.
	it('agrees with the rect the real builder cuts', () => {
		// Landscape and portrait, so both the side cut and the top-and-bottom cut
		// meet a crop that is itself wider or taller than the target ratio.
		const assets = [
			[2400, 1600],
			[1600, 2400],
		];
		const crops = [NO_CROP, { top: 0.1, bottom: 0, left: 0.2, right: 0.05 }];
		const ratios = [undefined, 1, 16 / 9, 0.7142857143, 0.6666666667];
		const spots = [spot(0.1, 0.1), spot(0.5, 0.9), spot(0.85, 0.3)];

		for (const [W, H] of assets) {
			for (const crop of crops) {
				for (const ratio of ratios) {
					for (const hotspot of spots) {
						const url = buildSanityImageUrl(
							{
								...asset(W, H),
								crop,
								hotspot: { ...hotspot, width: 0.2, height: 0.2 },
							},
							{ width: W, cropRatio: ratio }
						);
						const [left, top, width, height] = (
							params(url).get('rect') ?? `0,0,${W},${H}`
						)
							.split(',')
							.map(Number);
						const expected = [
							((hotspot.x * W - left) / width) * 100,
							((hotspot.y * H - top) / height) * 100,
						].map((v) => Math.min(100, Math.max(0, v)));
						const actual = (
							hotspotObjectPosition(W / H, crop, hotspot, ratio) ?? '50% 50%'
						)
							.split(' ')
							.map(parseFloat);

						expect(actual[0]).toBeCloseTo(expected[0], 0);
						expect(actual[1]).toBeCloseTo(expected[1], 0);
					}
				}
			}
		}
	});
});
