import type { Dictionary } from './dictionary';

/**
 * The badge vocabulary, in priority order — `options.list` for the pProduct
 * `badge` field, and the rank listing cards order badges by.
 *
 * One declaration, because the two would otherwise have to be kept in step by
 * hand: the Studio's checkboxes now render in the same order the card ranks by,
 * so the picker states the priority rather than contradicting it. Same shape as
 * `SIZE_UNIT_OPTIONS` in `size-measurements.ts`, which the gSizeChart schema
 * imports for the same reason.
 *
 * `satisfies` pins every value to a `products.badges` dictionary key, so adding
 * a badge without its label is a build error rather than a card that renders
 * the raw slug in both locales.
 */
export const PRODUCT_BADGE_OPTIONS = [
	{ title: 'New', value: 'new' },
	{ title: "Founder's Pick", value: 'founders-pick' },
	{ title: 'Most Popular', value: 'most-popular' },
	{ title: "Editor's Choice", value: 'editors-choice' },
] as const satisfies readonly {
	title: string;
	value: keyof Dictionary['products']['badges'];
}[];

const BADGE_RANK: readonly string[] = PRODUCT_BADGE_OPTIONS.map(
	(option) => option.value
);

function rankOf(badge: string): number {
	const i = BADGE_RANK.indexOf(badge);
	return i === -1 ? BADGE_RANK.length : i;
}

/**
 * Orders a product's badges by priority, dropping repeats. The Studio stores
 * this field in tick order, so the stored order is whatever the editor happened
 * to click first. An unrecognized value ranks last and keeps its relative
 * position rather than being dropped.
 *
 * The `Set` is not belt-and-braces: both render sites key on the token, so a
 * duplicate written by an import or a patch (the checkbox UI cannot produce
 * one) would put two children under the same React key.
 */
export function sortBadges(
	badges: readonly string[] | null | undefined
): string[] {
	return [...new Set(badges ?? [])].sort((a, b) => rankOf(a) - rankOf(b));
}

/**
 * The display label for a badge token, falling back to the raw token.
 *
 * `Object.hasOwn`, not a plain index: a token is an arbitrary string (the
 * field's `options.list` is a Studio affordance the Content Lake does not
 * enforce), and `t['__proto__']` or `t['toString']` resolves up the prototype
 * chain to a value `??` never treats as missing — handing React an object or a
 * function to render.
 */
export function badgeLabel(badge: string, t: Record<string, string>): string {
	return Object.hasOwn(t, badge) ? t[badge] : badge;
}
