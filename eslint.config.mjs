import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
	...nextVitals,
	// Override default ignores of eslint-config-next.
	globalIgnores([
		// Default ignores of eslint-config-next:
		'.next/**',
		'out/**',
		'build/**',
		'next-env.d.ts',
		// `.next/**` is root-anchored, so it misses build output nested inside
		// git worktrees (.claude/worktrees/*/.next). Those hold their own full
		// .next/, and ESLint OOMs trying to parse the generated bundles.
		'**/.next/**',
	]),
]);

export default eslintConfig;
