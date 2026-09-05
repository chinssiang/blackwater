import { describe, expect, it } from 'vitest';
import { deriveCardAddToCart } from './types';

// What a listing card may offer is decided entirely by this function, and every
// rule it encodes is invisible at the call site: ProductCard just renders
// whatever descriptor it is handed. The cases that matter are the ones where
// the honest answer is "nothing" — a card that guesses a variant puts the wrong
// thing in someone's cart.

const gid = (n: number) => `gid://shopify/ProductVariant/${n}`;

function variant(
	n: number,
	options: Array<[string, string]>,
	availableForSale = true
) {
	return {
		gid: gid(n),
		availableForSale,
		selectedOptions: options.map(([name, value]) => ({ name, value })),
	};
}

describe('deriveCardAddToCart', () => {
	it('adds directly when the product has no real options', () => {
		// Shopify models "no options" as a lone variant on a Title/Default Title
		// placeholder group, which must not surface as a chip.
		expect(
			deriveCardAddToCart({
				availableForSale: true,
				variants: [variant(1, [['Title', 'Default Title']])],
			})
		).toEqual({ kind: 'direct', merchandiseId: gid(1) });
	});

	it('offers chips for a single option group, in variant order', () => {
		expect(
			deriveCardAddToCart({
				availableForSale: true,
				variants: [
					variant(1, [['Size', 'S']]),
					variant(2, [['Size', 'M']], false),
					variant(3, [['Size', 'L']]),
				],
			})
		).toEqual({
			kind: 'options',
			optionName: 'Size',
			values: [
				{ value: 'S', merchandiseId: gid(1), availableForSale: true },
				{ value: 'M', merchandiseId: gid(2), availableForSale: false },
				{ value: 'L', merchandiseId: gid(3), availableForSale: true },
			],
		});
	});

	it('declines two or more option groups', () => {
		// A card has one row for chips. Picking a colour for the shopper is how
		// the wrong variant reaches the cart, so this belongs on the detail page.
		expect(
			deriveCardAddToCart({
				availableForSale: true,
				variants: [
					variant(1, [
						['Colour', 'Sand'],
						['Size', 'S'],
					]),
					variant(2, [
						['Colour', 'Black'],
						['Size', 'M'],
					]),
				],
			})
		).toBeNull();
	});

	it('declines a product Shopify reports as unavailable', () => {
		expect(
			deriveCardAddToCart({
				availableForSale: false,
				variants: [variant(1, [['Size', 'S']], false)],
			})
		).toBeNull();
	});

	it('declines a product with no variants at all', () => {
		expect(
			deriveCardAddToCart({ availableForSale: true, variants: [] })
		).toBeNull();
	});

	it('declines several variants that share no real option', () => {
		// Malformed rather than option-less: there is no way to tell these apart
		// on a card, so neither gets picked.
		expect(
			deriveCardAddToCart({
				availableForSale: true,
				variants: [
					variant(1, [['Title', 'Default Title']]),
					variant(2, [['Title', 'Default Title']]),
				],
			})
		).toBeNull();
	});

	it('keeps the first variant when a value repeats', () => {
		const result = deriveCardAddToCart({
			availableForSale: true,
			variants: [variant(1, [['Size', 'S']]), variant(2, [['Size', 'S']])],
		});
		expect(result).toEqual({
			kind: 'options',
			optionName: 'Size',
			values: [{ value: 'S', merchandiseId: gid(1), availableForSale: true }],
		});
	});
});
