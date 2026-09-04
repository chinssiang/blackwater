import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cn, TYPE_SCALE_CLASSES } from '@/lib/utils';

// The type tokens set a font-size from `@layer components`, so every Tailwind
// font-size utility beats them in the cascade. `cn()` therefore registers them
// with tailwind-merge, which strips the losing utility before it ever reaches
// the DOM. That registration is a hand-kept list beside a stylesheet, which is
// the shape of thing that silently rots — hence this file.

const CSS = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

describe('TYPE_SCALE_CLASSES', () => {
	it('lists exactly the t-* rules globals.css gives a font-size', () => {
		// Matched on the DECLARATION, not the name: registering a `t-*` that sets
		// no font-size would make it delete a `text-sm` it has nothing to replace.
		const defined = [...CSS.matchAll(/^\s*\.(t-[a-z0-9-]+)\s*\{([^}]*)\}/gm)]
			.filter(([, , body]) => /font-size:/.test(body))
			.map(([, name]) => name);

		expect(defined.length).toBeGreaterThan(0);
		expect([...defined].sort()).toEqual([...TYPE_SCALE_CLASSES].sort());
	});

	// The direction that actually bit: `Caption.tsx` asked for `t-l-sm` for
	// months, a rung that has never existed, and rendered at whatever it
	// inherited. Nothing above catches that -- it only reads the stylesheet.
	it('finds no t-* class in src/ that is not a real rung', () => {
		const rungs = new Set<string>(TYPE_SCALE_CLASSES);
		const used = new Map<string, string>();

		const SRC = new URL('..', import.meta.url);
		const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' });

		for (const file of files) {
			if (!/\.tsx?$/.test(file) || file.endsWith('type-scale.test.ts')) {
				continue;
			}
			for (const [, name] of readFileSync(new URL(file, SRC), 'utf8').matchAll(
				/(?<![\w-])(t-(?:h|b|l)-[a-z0-9]+|t-spec)(?![\w-])/g
			)) {
				if (!rungs.has(name)) used.set(name, file);
			}
		}

		expect(Object.fromEntries(used)).toEqual({});
	});
});

describe('cn() and the type tokens', () => {
	it('drops a font-size utility that precedes a token', () => {
		// The `<Button>` case: its cva base contributes `text-sm`, the call site
		// adds `t-l-2`. Without the merge rule both survived and `text-sm` won.
		expect(cn('text-sm font-medium', 't-l-2')).toBe('font-medium t-l-2');
		expect(cn('text-xs', 't-l-1')).toBe('t-l-1');
	});

	it('keeps a font-size utility that FOLLOWS a token', () => {
		// One-way on purpose: a call site may still opt out of the rung.
		expect(cn('t-l-2', 'text-sm')).toBe('t-l-2 text-sm');
	});

	it('leaves every non-font-size override alone', () => {
		// These are the deliberate escape hatches — weight, leading, casing and
		// colour are all overridden beside a token somewhere in the tree.
		expect(cn('t-b-1', 'font-bold')).toBe('t-b-1 font-bold');
		expect(cn('t-b-2', 'leading-snug')).toBe('t-b-2 leading-snug');
		expect(cn('t-l-2', 'uppercase')).toBe('t-l-2 uppercase');
		expect(cn('t-b-1', 'text-foreground')).toBe('t-b-1 text-foreground');
	});

	it('resolves two tokens to the last one', () => {
		expect(cn('t-h-2', 't-h-3')).toBe('t-h-3');
	});
});
