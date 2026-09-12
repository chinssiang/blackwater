import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests only. There is no RTL setup here on purpose: the things worth
// pinning are the locale/path/date helpers whose edge cases are invisible at the
// call site, not component rendering. The default environment is Node; a file
// that genuinely needs a DOM (consent.test.ts reads document.cookie) opts itself
// in with a `// @vitest-environment jsdom` comment rather than making every
// other file pay for one.
export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
			// `server-only` resolves its throwing `default` entry outside a
			// react-server condition, which vitest has no reason to set. Without this
			// the first test to reach src/sanity/lib/live.ts (pickLayoutData in
			// siteData.ts is one import away) fails with a message about Client
			// Components, naming the wrong problem entirely.
			'server-only': fileURLToPath(
				new URL('./node_modules/server-only/empty.js', import.meta.url)
			),
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
			// The SEO builders read SITE_URL at module scope to build absolute URLs;
			// without one `new URL` throws before a single assertion runs.
			SITE_URL: 'https://blackwaterrc.com',
		},
	},
});
