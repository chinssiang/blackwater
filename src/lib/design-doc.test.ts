import { describe, expect, it } from 'vitest';
import { TYPE_SCALE_CLASSES } from '@/lib/utils';
import { existsSync, readFileSync } from 'node:fs';

// DESIGN.md is the canonical reference for the visual system, and nothing in the
// build reads it. It was generated once and left for 105 commits, by which point
// it named Radix (migrated away six weeks earlier), listed eight type rungs at
// fixed pixel sizes (nine, all fluid), inverted the sign on t-spec's tracking and
// pointed at a motion preset that does not exist. Every one of those is a rename
// or a deletion elsewhere in the repo.
//
// So this file checks NAMES — identifiers that must still resolve to something
// real. A wrong value is a documentation bug a reader can spot; a token or path
// that no longer exists is a trap an agent builds on. Asserting the clamps here
// would only duplicate type-scale.test.ts and make the doc expensive to edit,
// which is how it rotted in the first place.
//
// The one exception is the stale-library check below, which does match prose. It
// is deliberate: the Base UI migration is the drift that cost the old file most,
// and the claim it got wrong lived in a sentence, not in an identifier.

const ROOT = new URL('../../', import.meta.url);
const DOC = readFileSync(new URL('DESIGN.md', ROOT), 'utf8');
const CSS = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

// The dead/broken section is excluded from the custom-property check on purpose:
// naming a token as removed is the whole point of it, and two of its entries are
// broken REFERENCES to properties that are genuinely undefined (--s-max,
// --color-gray). The rung and path checks read the whole doc, since that section
// names live files.
const DEAD_HEADING = '## Known dead or broken';
const SPLIT = DOC.indexOf(DEAD_HEADING);
if (SPLIT < 0) {
	// Without this, -1 slices the doc into "everything but the last character"
	// and "the last character", and every assertion below fails on a phantom
	// token instead of on the renamed heading.
	throw new Error(`DESIGN.md no longer has a "${DEAD_HEADING}" heading.`);
}
const LIVE_DOC = DOC.slice(0, SPLIT);
const KNOWN_DEAD = DOC.slice(SPLIT);

/** Every custom property globals.css declares or reads, by exact name. */
const CSS_PROPERTIES = new Set(
	[...CSS.matchAll(/--[a-z][a-z0-9-]*/g)].map(([name]) => name)
);

describe('DESIGN.md stays in step with the code', () => {
	it('names only custom properties globals.css still knows about', () => {
		// Declared OR referenced: several of these are written inline by a component
		// (--section-pt from SectionShell, --reveal-delay from a style prop) and
		// only ever appear in globals.css inside a var(). A rename or a deletion —
		// the failure this exists for — takes the name out of the file either way.
		// Matched anywhere, not only inside backticks: one backtick span can hold two
		// properties (`--width-<step>: min(…, --container-<step>)`) and a span-shaped
		// regex sees only the first. The set is identical today and cannot go blind.
		const named = new Set(
			[...LIVE_DOC.matchAll(/--[a-z][a-z0-9-]*/g)]
				.map(([name]) => name)
				// Wildcard stubs: `--t-size-*`, `--width-<step>`, `--padding-<step>`.
				.filter((name) => !name.endsWith('-'))
		);

		// Vocabularies this repo does not own and cannot look up locally.
		const EXTERNAL = new Set([
			'--radius-md', // Tailwind v4's own default
			// Base UI's popup variables, named in §Components as the replacements
			// for the --radix-* ones.
			'--transform-origin',
			'--available-height',
			'--anchor-width',
			'--accordion-panel-height',
		]);

		// Exact names, never `CSS.includes(n)`: a substring test passes for a token
		// that is merely a PREFIX of a surviving one, so renaming `--muted` while
		// `--muted-foreground` stays would leave the doc naming a dead token and
		// this check green. Nine documented tokens sit in that relationship.
		const missing = [...named].filter(
			(n) => !EXTERNAL.has(n) && !CSS_PROPERTIES.has(n)
		);
		expect(named.size).toBeGreaterThan(20);
		expect(missing).toEqual([]);
	});

	it('names only type rungs that exist', () => {
		// Extract BROADLY and filter against the exported list, rather than encoding
		// the rung shape in the regex. A `t-[a-z]-[0-9]` pattern cannot match t-spec
		// — the one rung whose documented tracking sign the old file got wrong — so
		// it would have passed over exactly the drift this check exists for.
		const rungs = TYPE_SCALE_CLASSES as readonly string[];
		const named = new Set(
			[...DOC.matchAll(/`(t-[a-z][a-z0-9-]*)`/g)].map(([, n]) => n)
		);
		expect(named.size).toBeGreaterThan(5);
		expect([...named].filter((n) => !rungs.includes(n))).toEqual([]);
	});

	it('names only source files that exist', () => {
		// Backticked repo paths; a `foo.ts:91` line suffix is stripped.
		const named = new Set(
			[
				...DOC.matchAll(
					/`((?:src|public|scripts|docs|\.claude)\/[\w./[\]()-]+\.\w+)(?::\d+)?`/g
				),
			].map(([, p]) => p)
		);
		expect(named.size).toBeGreaterThan(10);
		expect([...named].filter((p) => !existsSync(new URL(p, ROOT)))).toEqual([]);
	});

	it('does not present Radix as the primitive layer', () => {
		// The Base UI migration (de6f50a) is what made the old file wrong in the way
		// that was hardest to notice — `data-[state=active]` compiles fine and
		// silently never matches. The doc may still NAME the Radix spellings, as
		// §Anti-patterns does; what it must not do is present them as current.
		expect(readFileSync(new URL('package.json', ROOT), 'utf8')).not.toContain(
			'@radix-ui'
		);
		expect(LIVE_DOC).toContain('Base UI');
		for (const staleClaim of ['shadcn/Radix', 'Radix components']) {
			expect(LIVE_DOC).not.toContain(staleClaim);
		}
	});

	it('does not let the removed tokens come back unnoticed', () => {
		// Deleted from globals.css in the same commit that pruned them from the doc's
		// dead list, for one of two reasons: zero consumers, or resolving to invalid
		// CSS because they read a property nothing defines. Re-adding one is fine —
		// but it has to be a deliberate act that also updates this list, not a silent
		// paste from an old branch.
		for (const token of [
			'--positive:',
			'--negative:',
			'--neutral:',
			'--radius:',
			'--shadow-default:',
			'--spacing-contain-dynamic:',
			'--color-subtle:',
			'--color-placeholder:',
		]) {
			expect(CSS).not.toContain(token);
		}
		// The hotkey that could never fire, for the same reason.
		expect(
			readFileSync(
				new URL('../components/ThemeProvider.tsx', import.meta.url),
				'utf8'
			)
		).not.toContain('ThemeHotkey');
	});

	it('still records what was deliberately KEPT as dead-looking', () => {
		// --h-announcement is never written, but gAnnouncement is a built Sanity
		// singleton and several modules already read the property defensively. It is
		// scaffolding, not debris. If something starts writing it, prune the doc.
		expect(KNOWN_DEAD).toContain('--h-announcement');
		expect(CSS).toContain('--h-announcement');
	});

	it('is pointed at by CLAUDE.md through headings that exist', () => {
		// CLAUDE.md handed its design law to this file and left `DESIGN.md (§X)`
		// pointers behind. Renaming a heading here would rot every one of them
		// silently — which is the same failure class this whole file exists to end,
		// just relocated one file over.
		const claude = readFileSync(new URL('CLAUDE.md', ROOT), 'utf8');
		const referenced = [...claude.matchAll(/DESIGN\.md \(§([^)]+)\)/g)].map(
			([, heading]) => heading
		);
		expect(referenced.length).toBeGreaterThan(0);
		// Anchored on the trailing newline: an unanchored match also accepts any
		// heading that merely STARTS with the referenced name, so renaming
		// `## Components` to `## Components and primitives` would pass.
		expect(referenced.filter((h) => !DOC.includes(`\n## ${h}\n`))).toEqual([]);
	});
});
