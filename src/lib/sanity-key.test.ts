import { describe, expect, it } from 'vitest';
import { newArrayKey } from './sanity-key';

describe('newArrayKey', () => {
	it('is twelve lowercase hex characters', () => {
		for (let i = 0; i < 200; i++) {
			expect(newArrayKey()).toMatch(/^[0-9a-f]{12}$/);
		}
	});

	it('does not repeat across a document-sized batch', () => {
		const keys = new Set(Array.from({ length: 1000 }, newArrayKey));
		expect(keys.size).toBe(1000);
	});
});
