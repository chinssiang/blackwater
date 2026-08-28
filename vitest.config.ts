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
	},
});
