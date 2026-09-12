import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	PAGE_MODULES_FIELD,
	hostModuleHidden,
	moduleRule,
} from './page-module';
import type { ValidationContext } from 'sanity';

const OBJECTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(OBJECTS_DIR, '..');

// A validation context carrying only what hostModuleHidden reads. The real one
// also brings a client, a schema and an environment, none of which it touches.
const ctx = (document: unknown, path?: unknown) =>
	({ document, path }) as unknown as ValidationContext;

const doc = {
	_type: 'pHome',
	[PAGE_MODULES_FIELD]: [
		{ _key: 'off', _type: 'faqBlock', hidden: true },
		{ _key: 'on', _type: 'faqBlock' },
		{ _key: 'explicitlyOn', _type: 'faqBlock', hidden: false },
	],
};

describe('hostModuleHidden', () => {
	it('sees a field directly on a switched-off module', () => {
		expect(
			hostModuleHidden(
				ctx(doc, [PAGE_MODULES_FIELD, { _key: 'off' }, 'faqSet'])
			)
		).toBe(true);
	});

	// The hero and events CTA rules sit inside a `callToAction` object, so the
	// module is their grandparent -- `context.parent` would find the CTA.
	it('sees a field nested deeper inside a switched-off module', () => {
		expect(
			hostModuleHidden(
				ctx(doc, [PAGE_MODULES_FIELD, { _key: 'off' }, 'callToAction', 'link'])
			)
		).toBe(true);
	});

	it.each([
		['a visible module', [PAGE_MODULES_FIELD, { _key: 'on' }, 'faqSet']],
		[
			'an explicitly-visible module',
			[PAGE_MODULES_FIELD, { _key: 'explicitlyOn' }, 'faqSet'],
		],
		['an unknown key', [PAGE_MODULES_FIELD, { _key: 'nope' }, 'faqSet']],
		['a path outside pageModules', ['sharing', 'metaTitle']],
		[
			'a nested pageModules the document lookup could not read',
			['sections', { _key: 's' }, PAGE_MODULES_FIELD, { _key: 'off' }],
		],
	])('validates as normal for %s', (_name, path) => {
		expect(hostModuleHidden(ctx(doc, path))).toBe(false);
	});

	it('validates as normal with no path or no document', () => {
		expect(hostModuleHidden(ctx(doc, undefined))).toBe(false);
		expect(
			hostModuleHidden(ctx(undefined, [PAGE_MODULES_FIELD, { _key: 'off' }]))
		).toBe(false);
	});
});

describe('moduleRule', () => {
	const hiddenPath = [PAGE_MODULES_FIELD, { _key: 'off' }, 'faqSet'];
	const visiblePath = [PAGE_MODULES_FIELD, { _key: 'on' }, 'faqSet'];

	it('clears an error when the host module is switched off', () => {
		expect(moduleRule(() => 'Pick a set.')(null, ctx(doc, hiddenPath))).toBe(
			true
		);
	});

	it('keeps the error when the host module is visible', () => {
		expect(moduleRule(() => 'Pick a set.')(null, ctx(doc, visiblePath))).toBe(
			'Pick a set.'
		);
	});

	it('passes a passing check straight through', () => {
		expect(moduleRule(() => true)(null, ctx(doc, visiblePath))).toBe(true);
	});

	// The scan is skipped on the passing path, which is the whole reason the
	// wrapper checks the result before the document.
	it('does not consult the document when the check passes', () => {
		let reads = 0;
		const spied = new Proxy(doc, {
			get(target, prop) {
				if (prop === PAGE_MODULES_FIELD) reads++;
				return Reflect.get(target, prop);
			},
		});
		moduleRule(() => true)(null, ctx(spied, hiddenPath));
		expect(reads).toBe(0);
	});
});

// The exemption is one invariant spread across every module file, and
// hand-editing each call site is how you miss one: events-block's two CTA rules
// shipped without it on the first pass. Assert it mechanically on the source
// text -- importing the schemas would drag @sanity/ui and JSX into this node-env
// suite.
describe('every page-module Rule.custom goes through moduleRule', () => {
	// Membership comes from the REGISTRY, not from a directory scan. Scanning
	// `objects/` for a registration string had two escape hatches, and the diff
	// that introduced this guard walked into one of them: the filter only read
	// `.ts`, so `freeform.js` had to be renamed to become visible -- and six
	// files in that directory are still `.js`/`.jsx` while `portable-text.tsx`
	// shows `.tsx` is idiomatic too. A module authored as `.js` or `.tsx`, or
	// registered as `components: { ...pageModuleComponents }`, was simply never
	// read, and the count floor could not tell (the five existing files satisfied
	// it). `pHome.pageModules`' `of: []` list is the actual definition of what a
	// page module is, so ask that instead.
	const MODULES_DIR = OBJECTS_DIR;
	// BOTH host arrays. p-home.ts alone left a type registered only on pGeneral
	// invisible to every guard below -- the exact "both `of: []` lists" drift
	// CLAUDE.md flags, and the one thing the old directory scan did catch.
	const HOSTS = [
		join(SCHEMA_DIR, 'singletons/p-home.ts'),
		join(SCHEMA_DIR, 'documents/p-general.ts'),
	];

	/** `heroBlock` -> `hero-block` */
	const kebab = (name: string) =>
		name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

	// Memoized: three `it` blocks below read these, and without the cache each
	// one re-read p-home.ts plus all five module files. The assertion stays
	// inside moduleFiles() rather than moving to describe scope, so a missing
	// source file still fails as a test rather than at collection time.
	let typeNamesCache: string[] | undefined;
	const moduleTypeNames = () => {
		if (typeNamesCache) return typeNamesCache;

		const found = new Set<string>();
		for (const host of HOSTS) {
			const src = readFileSync(host, 'utf8');
			const field = src.indexOf(`name: '${PAGE_MODULES_FIELD}'`);
			expect(field, `${host}: no ${PAGE_MODULES_FIELD} field`).toBeGreaterThan(
				-1
			);

			// Bounded to the array's own `of: [ ... ]`, searched FORWARD from the
			// field. `indexOf('preview:')` searched from offset 0, so the window
			// could start after its own end (slicing to '' and silently emptying
			// two of the three checks below) or swallow unrelated `{ type: 'x' }`
			// literals from any field declared between the two offsets.
			const open = src.indexOf('of: [', field);
			const close = src.indexOf('],', open);
			expect(
				open > -1 && close > open,
				`${host}: could not bound ${PAGE_MODULES_FIELD}'s of: [] list`
			).toBe(true);

			// No `\}` terminator: a member may carry more than `type`, and
			// `{ type: 'x', title: 'y' }` is idiomatic in this repo. Requiring a
			// bare `{ type: 'x' }` let such a member escape every guard while the
			// count floor still passed on the five that happened to be bare.
			for (const m of src
				.slice(open, close)
				.matchAll(/\{\s*type:\s*'(\w+)'/g)) {
				found.add(m[1]);
			}
		}

		typeNamesCache = [...found];
		return typeNamesCache;
	};

	/** Every registered module type paired with its source file. */
	let moduleFilesCache: readonly (readonly [string, string])[] | undefined;
	const moduleFiles = () =>
		(moduleFilesCache ??= moduleTypeNames().map((type) => {
			const candidates = ['ts', 'tsx', 'js', 'jsx'].map(
				(ext) => `${kebab(type)}.${ext}`
			);
			const file = candidates.find((f) => existsSync(join(MODULES_DIR, f)));

			expect(
				file,
				`no source file for registered module type '${type}' (looked for ${candidates.join(', ')})`
			).toBeDefined();

			return [file!, readFileSync(join(MODULES_DIR, file!), 'utf8')] as const;
		}));

	it('finds every registered module type', () => {
		// Guards the guard, and now cannot pass vacuously: the list comes from
		// p-home.ts, so it is empty only if the array itself is gone.
		expect(moduleTypeNames().length).toBeGreaterThanOrEqual(5);
	});

	it('registers both Studio halves on every module type', () => {
		for (const [file, src] of moduleFiles()) {
			expect(
				src.includes('components: pageModuleComponents'),
				`${file}: does not register pageModuleComponents, so it has no visibility toggle`
			).toBe(true);

			// The other half. Registering the components without the field is the
			// failure page-module.ts calls worse than neither: the eye patches a
			// field the schema does not declare, so the Studio files the row under
			// "Fields not defined in schema" while the site hides the module.
			expect(
				src.includes('pageModuleHidden()'),
				`${file}: does not declare pageModuleHidden(), so the eye would write a field the schema does not have`
			).toBe(true);
		}
	});

	it('wraps every validator', () => {
		let checked = 0;

		for (const [file, src] of moduleFiles()) {
			// `\.custom\(`, not `Rule\.custom\(`: a rule chained after another
			// method -- `Rule.required().custom(fn)` -- has a callback, is
			// wrappable, and was invisible to the anchored pattern.
			for (const match of src.matchAll(/\.custom\(\s*/g)) {
				const after = src.slice(match.index + match[0].length);
				expect(
					after.startsWith('moduleRule('),
					`${file}: a Rule.custom at index ${match.index} is not wrapped in moduleRule(), so a switched-off module would still block publishing`
				).toBe(true);
				checked++;
			}
		}

		// Non-vacuity as a floor, not an exact count: a legitimately added
		// validator must not fail this test, but validators silently disappearing
		// must. (freeform carries none, so this is a total, not a per-file check.)
		expect(checked).toBeGreaterThan(0);
	});
});

// The `pageModules` field name is a string in four independent places, and only
// one of them is this constant: the two array declarations and the GROQ in
// queries.ts spell it literally. A rename that updated the schemas and GROQ --
// the natural set -- would leave `hostModuleHidden` comparing path[0] against
// the old name, silently returning false for every field and putting every
// switched-off module back to blocking publishing, with no type error.
//
// Pinned here by source text rather than by having queries.ts interpolate the
// constant: queries.ts is imported by frontend pages, and page-module.ts imports
// `defineField` from `sanity`, so wiring them together would pull the Studio
// package into the site bundle. Cross-module interpolation is also the shape the
// GROQ extractor resolves least reliably, and it fails silently (see the note
// above `moduleVisible`).
describe('the pageModules field name agrees everywhere', () => {
	it.each([
		['singletons/p-home.ts', `name: '${PAGE_MODULES_FIELD}'`],
		['documents/p-general.ts', `name: '${PAGE_MODULES_FIELD}'`],
	])('%s declares the array', (file, needle) => {
		const src = readFileSync(join(SCHEMA_DIR, file), 'utf8');
		expect(src).toContain(needle);
	});

	it('queries.ts filters that array, not another name', () => {
		const src = readFileSync(
			new URL('../../lib/queries.ts', import.meta.url),
			'utf8'
		);
		const traversals = [...src.matchAll(/(\w+)\[\$\{moduleVisible\}\]/g)];

		expect(traversals.length).toBeGreaterThan(0);
		for (const [, field] of traversals) {
			expect(field).toBe(PAGE_MODULES_FIELD);
		}
	});
});

// Slot 0 owns the page's <h1>, and slot 0 is decided by POSITION -- hidden
// modules are filtered in GROQ, so hiding a hero promotes whatever follows it.
// `headingLevel` therefore has to reach every type that renders a heading, not
// just heroBlock: while only HeroBlock read it, hiding the top hero left the
// homepage with no <h1> at all, silently. Freeform is excluded on purpose (its
// headings come from prose, which authors control directly).
describe('the h1 contract', () => {
	it('routes headingLevel to every module that renders a heading', () => {
		const src = readFileSync(
			new URL('../../../components/PageModules.tsx', import.meta.url),
			'utf8'
		);
		const receivers = [...src.matchAll(/<(\w+)[^>]*\bheadingLevel=/g)].map(
			(m) => m[1]
		);

		expect(new Set(receivers)).toEqual(
			new Set(['HeroBlock', 'FaqBlock', 'EventsBlock', 'ProductsBlock'])
		);
	});

	it('gives SectionShell a headingLevel so the tag is not hardcoded', () => {
		const src = readFileSync(
			new URL('../../../components/SectionShell.tsx', import.meta.url),
			'utf8'
		);

		// The shell is the one place a module heading becomes an element, so a
		// hardcoded <h2> there is what made the level unreachable for four of the
		// five types no matter what PageModules passed.
		expect(src).toContain('headingLevel');
		expect(src).not.toMatch(/<h2\s/);
	});
});
