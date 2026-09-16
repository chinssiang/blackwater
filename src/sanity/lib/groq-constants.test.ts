import { describe, expect, it } from 'vitest';
import { DOCUMENT_ROUTES, buildResolvedHrefGroq } from '@/lib/routes';
import { RESOLVED_HREF_GROQ } from './groq-constants.generated';

/**
 * The in-process half of the staleness guard. CI runs `npm run typegen` and then
 * `git diff --exit-code` on the generated file, which catches a commit that
 * forgot to regenerate; this catches it in the unit suite, where the feedback is
 * immediate.
 *
 * Asserting against the BUILDER, not a copied expectation: a test that restates
 * the expected GROQ passes whatever the test says, which is the failure mode the
 * old hand-maintained literal had.
 */
describe('groq-constants.generated', () => {
	it('matches what the builder produces from DOCUMENT_ROUTES', () => {
		expect(RESOLVED_HREF_GROQ).toBe(buildResolvedHrefGroq());
	});

	// One Set, one assertion, both directions. Set equality is strictly stronger
	// than the two membership tests this replaces — it also catches a duplicate
	// arm — and it was previously spelled a third time in routes.test.ts.
	it('arms exactly the routed types that back a real document', () => {
		const armed = [...RESOLVED_HREF_GROQ.matchAll(/_type == "([^"]+)"/g)].map(
			(m) => m[1]
		);
		const expected = DOCUMENT_ROUTES.filter((route) => !route.synthetic).map(
			(route) => route.type
		);

		expect(expected.length).toBeGreaterThan(5);
		expect([...armed].sort()).toEqual([...expected].sort());
	});

	it('emits each route its own path, not just its _type', () => {
		// The gap this closes: the previous test only compared the SET of _type
		// arms, so changing a path in DOCUMENT_ROUTES (say /products/ -> /shop/)
		// left the hand-written GROQ emitting the old URL in every menu, forever.
		for (const route of DOCUMENT_ROUTES) {
			if (route.synthetic || route.type === 'pHome') continue;
			const expected = route.slug
				? `_type == "${route.type}" => "${route.path}" + slug.current`
				: `_type == "${route.type}" => "${route.path}"`;
			expect(RESOLVED_HREF_GROQ).toContain(expected);
		}
	});
});
