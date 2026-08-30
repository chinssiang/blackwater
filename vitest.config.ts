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
		},
	},
});
