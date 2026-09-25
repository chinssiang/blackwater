import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// three.js and react-three-fiber are ~200KB gzip. They stay in /playground's
// own chunk only while (a) nothing outside the scene folder imports them and
// (b) the one way into the scene folder is RunLabSceneLazy's dynamic import.
// A single static import anywhere else puts them into a shared chunk, and no
// other check would notice until someone read a bundle report.
const SRC = join(process.cwd(), 'src');
const SCENE_DIR =
	'app/(frontend)/[locale]/(site)/playground/_components/scene/';
const LAZY =
	'app/(frontend)/[locale]/(site)/playground/_components/RunLabSceneLazy.tsx';

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return /\.(ts|tsx|mts)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
	});
}

const files = sourceFiles(SRC).map((path) => ({
	path: relative(SRC, path),
	source: readFileSync(path, 'utf8'),
}));

const IMPORT = /(?:from|import\()\s*['"]([^'"]+)['"]/g;
const importsOf = (source: string) =>
	[...source.matchAll(IMPORT)].map((m) => m[1]);

describe('Run Lab bundle isolation', () => {
	it('imports three.js only inside the scene folder', () => {
		const offenders = files
			.filter((f) => !f.path.startsWith(SCENE_DIR))
			.filter((f) =>
				importsOf(f.source).some(
					(s) =>
						s === 'three' ||
						s.startsWith('three/') ||
						s.startsWith('@react-three/')
				)
			)
			.map((f) => f.path);
		expect(offenders).toEqual([]);
	});

	it('reaches the scene folder only through RunLabSceneLazy', () => {
		const offenders = files
			.filter((f) => !f.path.startsWith(SCENE_DIR) && f.path !== LAZY)
			.filter((f) =>
				importsOf(f.source).some(
					(s) => s.includes('scene/') || s.includes('/scene')
				)
			)
			.map((f) => f.path);
		expect(offenders).toEqual([]);
	});

	it('loads the scene with a dynamic import', () => {
		const lazy = files.find((f) => f.path === LAZY);
		expect(lazy?.source).toMatch(
			/dynamic\(\s*\(\)\s*=>\s*import\('\.\/scene\/RunLabScene'\)/
		);
		expect(lazy?.source).not.toMatch(/^import[^;]*['"]\.\/scene\//m);
	});
});
