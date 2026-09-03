import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests only — pure modules under src/lib. There is no jsdom/RTL setup
// here on purpose: the things worth pinning are the locale/path helpers whose
// edge cases are invisible at the call site, not component rendering.
export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		// src/sanity/env.ts throws on import when these are unset, and it is pulled
		// in transitively by lib/image-utils (for the image-url builder) which the
		// colour helpers happen to share a file with. Placeholders: nothing under
		// test makes a network call.
		env: {
			NEXT_PUBLIC_SANITY_DATASET: 'test',
			NEXT_PUBLIC_SANITY_PROJECT_ID: 'test',
			// Deliberately NOT UTC. Every date helper here exists to stop a civil
			// date being resolved in the runtime's timezone, and under UTC the naive
			// implementations they replace pass every assertion — `format(new
			// Date('2026-09-05'))` only prints the 4th somewhere west of Greenwich.
			// Running the suite in a negative-offset zone is what makes those tests
			// able to fail. CI sets no TZ, so without this it inherits UTC.
			TZ: 'America/Los_Angeles',
		},
	},
});
