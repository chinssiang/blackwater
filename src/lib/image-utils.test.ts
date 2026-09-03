import { describe, expect, it } from 'vitest';
import { ensureAccessibleTextColor } from './image-utils';

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
