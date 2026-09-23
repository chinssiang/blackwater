// A Sanity array `_key`: 12 lowercase hex characters. Generated here rather
// than through `@sanity/util/content`'s `randomKey`, which is only a transitive
// dependency. `getRandomValues`, not `randomUUID`: the latter exists only in
// secure contexts, and the dev Studio is also opened over plain http on a LAN
// IP (`allowedDevOrigins` in next.config.mjs), where it is undefined.
export const newArrayKey = (): string =>
	Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
		b.toString(16).padStart(2, '0')
	).join('');
