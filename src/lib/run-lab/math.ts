/** Small numeric helpers shared by Run Lab's logic and its scene. */

export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) =>
	Math.min(hi, Math.max(lo, v));

/** Wrap into [0, m): a phase (m = 1), a tile offset, a step count. */
export const mod = (v: number, m = 1) => ((v % m) + m) % m;

/**
 * A deterministic generator (Park–Miller), so a painted print or a tile's
 * scatter looks the same on every load. `seed` must be a positive integer.
 */
export function seededRandom(seed: number) {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return s / 2147483647;
	};
}
