import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@': srcDir,
			'sanity.types': `${rootDir}sanity.types.ts`,
			'sanity.config': `${rootDir}sanity.config.ts`,
		},
	},
	test: {
		// Pure-logic unit tests run in Node; opt individual files into jsdom
		// with a `// @vitest-environment jsdom` comment when they touch the DOM.
		environment: 'node',
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		setupFiles: ['./vitest.setup.ts'],
		globals: true,
	},
});
