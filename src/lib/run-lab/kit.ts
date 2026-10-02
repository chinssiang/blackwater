import type { TopId } from './types';

/**
 * What the runner wears, and the contract with the model's mesh names (see
 * scripts/build-runner-model.mjs). The body is split into regions so a
 * garment can HIDE what it covers: skin that is not drawn cannot poke
 * through fabric, however far a joint bends.
 */

export const BODY_NODES = [
	'Body_head',
	'Body_torsoLower',
	'Body_torsoUpper',
	'Body_armTop',
	'Body_armMid',
	'Body_arms',
	'Body_hands',
	'Body_thighTop',
	'Body_legs',
	'Body_feet',
] as const;
export type BodyNode = (typeof BODY_NODES)[number];

export const topNode = (top: TopId) => `Top_${top}`;
export const BOTTOM_NODES = ['Bottom_tight', 'Bottom_tight_pockets'] as const;
export const SHOE_NODES = [
	'Shoes_midsole',
	'Shoes_upper',
	'Shoes_outsole',
] as const;

// A set-in sleeve covers the upper arm to its hem; the cut-off's dropped
// shoulder covers only the deltoid band; the singlet leaves the shoulders and
// upper chest bare, between its straps.
const TOP_COVERS: Record<TopId, readonly BodyNode[]> = {
	component: ['Body_torsoUpper', 'Body_armTop', 'Body_armMid'],
	communion: ['Body_torsoUpper', 'Body_armTop', 'Body_armMid'],
	coda: [],
	hoole: ['Body_torsoUpper', 'Body_armTop'],
};
// Every top covers the lower torso, and the half tight and shoes are always on.
const ALWAYS_COVERED: readonly BodyNode[] = [
	'Body_torsoLower',
	'Body_thighTop',
	'Body_feet',
];

/**
 * The hair is no garment, but it is handled like one: it keeps the colour
 * the model gives it rather than the body's clay, and the Pacer, which is
 * the form alone, goes without.
 */
export const HAIR_NODE = 'Hair';

const KIT_PREFIXES = ['Top_', 'Bottom_', 'Shoes_', HAIR_NODE];
export const isKitNode = (name: string) =>
	KIT_PREFIXES.some((p) => name.startsWith(p));

/**
 * Whether a named part of the model shows on the runner wearing `top`.
 * Decals are named after their garment (`Top_coda_decal0`), so they follow it.
 */
const COVERED = Object.fromEntries(
	(Object.keys(TOP_COVERS) as TopId[]).map((top) => [
		top,
		new Set<string>([...TOP_COVERS[top], ...ALWAYS_COVERED]),
	])
) as Record<TopId, Set<string>>;

export function isNodeVisible(name: string, top: TopId): boolean {
	if (name.startsWith('Body_')) return !COVERED[top].has(name);
	if (name.startsWith('Top_'))
		return name === topNode(top) || name.startsWith(`${topNode(top)}_`);
	return true;
}

/** Product pages the Kit tab links to, by slug. */
export const KIT_PRODUCT_SLUGS = {
	component: 'component-ss-t',
	coda: '2502-coda-performance-tank',
	hoole: 'hoole-cut-off',
	communion: 'communion-t-new-balance-redux',
	tight: 'sleek-pocket-half-tight-9',
	shoes: 'fuelcell-rebel-v5',
} as const satisfies Record<TopId | 'tight' | 'shoes', string>;

/** Decal materials are painted at runtime; the part after `Decal_` names the art. */
export const DECALS = ['blkwtr', 'nb', 'hoole', 'n'] as const;
export type DecalId = (typeof DECALS)[number];
export function decalFor(materialName: string): DecalId | null {
	const id = materialName.startsWith('Decal_') ? materialName.slice(6) : null;
	return id && (DECALS as readonly string[]).includes(id)
		? (id as DecalId)
		: null;
}

/** Spring-driven hem bone; no clip animates it. */
export const CLOTH_HEM_BONE = 'ClothHem';
