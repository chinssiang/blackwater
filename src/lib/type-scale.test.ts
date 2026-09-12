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
		//
		// Whole rules, not `^\s*\.t-… {`: that shape only ever sees a rung that is
		// the sole selector on its line, so `.t-l-1,\n.t-l-2 { … }` would be
		// invisible here AND absent from the list, and the comparison below would
		// pass on exactly the drift it exists to catch. Comments are stripped
		// first, because the selector capture reaches back over them and several
		// of them name rungs in prose.
		const defined = [
			...CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g),
		]
			.filter(([, , body]) => /font-size:/.test(body))
			.flatMap(([, selectors]) =>
				[...selectors.matchAll(/\.(t-[a-z0-9-]+)(?![\w-])/g)].map(([, n]) => n)
			);

		expect(defined.length).toBeGreaterThan(0);
		expect([...defined].sort()).toEqual([...TYPE_SCALE_CLASSES].sort());
	});

	// The `:root` comment states this invariant and nothing enforced it: "give
	// the intercept FOUR decimals: at three, rounding moves a rung's window by up
	// to 15px and the ladder stops sharing one. That is not hypothetical --
	// h1/h2/h3 sat at three decimals and ended their ramps at 1441/1429/1437px."
	// A rung written on a wrong slope, or rounded to three decimals, reproduces
	// exactly that while every other test in this file still passes.
	it('ramps every rung across one shared viewport window', () => {
		const ROOT_PX = 16;
		const rungs = [
			...CSS.matchAll(
				/clamp\(\s*([\d.]+)rem,\s*([\d.]+)rem\s*\+\s*([\d.]+)vw,\s*([\d.]+)rem\s*\)/g
			),
		].map(([, min, intercept, slope, max]) => {
			// Where the middle term crosses each end of the clamp, in px of viewport.
			const perPx = Number(slope) / 100;
			const base = Number(intercept) * ROOT_PX;
			return {
				start: (Number(min) * ROOT_PX - base) / perPx,
				end: (Number(max) * ROOT_PX - base) / perPx,
			};
		});

		// Every `clamp()` in the stylesheet is a type size today; if a non-type one
		// is ever added this needs scoping to the font-size declarations.
		expect(rungs.length).toBeGreaterThan(8);

		const spread = (ns: number[]) => Math.max(...ns) - Math.min(...ns);
		// 5px: the three-decimal regression above spread the ends by 15px, and the
		// current values sit inside 1px at both edges.
		expect(spread(rungs.map((r) => r.start))).toBeLessThan(5);
		expect(spread(rungs.map((r) => r.end))).toBeLessThan(5);
	});

	// The direction that actually bit: `Caption.tsx` asked for `t-l-sm` for
	// months, a rung that has never existed, and rendered at whatever it
	// inherited. Nothing above catches that -- it only reads the stylesheet.
	it('finds no t-* class in src/ that is dead or not a real rung', () => {
		const rungs = new Set<string>(TYPE_SCALE_CLASSES);
		const used = new Map<string, string>();

		const SRC = new URL('..', import.meta.url);
		const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' });

		for (const file of files) {
			if (!/\.tsx?$/.test(file) || file.endsWith('type-scale.test.ts')) {
				continue;
			}
			for (const [, prefix, name] of readFileSync(
				new URL(file, SRC),
				'utf8'
			).matchAll(
				/(?<![\w-])((?:[a-z0-9-]+:)*)(t-(?:h|b|l)-[a-z0-9]+|t-spec)(?![\w-])/g
			)) {
				// A VARIANT on a rung emits no CSS: these are plain classes in
				// @layer components, so Tailwind generates no `lg:` form for them.
				// `lg:t-l-1` sat in the Footer looking load-bearing and doing
				// nothing, so it belongs in this list beside a misspelt rung.
				if (prefix || !rungs.has(name)) used.set(prefix + name, file);
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

	it('drops a leading utility that precedes a token', () => {
		// A rung sets line-height too. `DialogTitle`'s base is the case that bit:
		// `leading-none` outlived a `t-h-3` and clipped the size-chart title.
		expect(cn('text-lg leading-none font-semibold', 't-h-3')).toBe(
			'font-semibold t-h-3'
		);
		// ...and still yields to a deliberate one after it.
		expect(cn('t-b-2', 'leading-snug')).toBe('t-b-2 leading-snug');
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

	// The one trap the merge cannot see, pinned so it stays a known quantity:
	// tailwind-merge resolves conflicts only WITHIN a modifier scope, so a token
	// beside a responsive pair takes the unprefixed half and leaves the other
	// standing. `<Input>`'s base is `text-base … md:text-sm`, so a rung on one
	// would render the field below 16px on a phone and iOS would zoom on focus.
	it('cannot clear a font-size behind a modifier', () => {
		expect(cn('text-base md:text-sm', 't-b-2')).toBe('md:text-sm t-b-2');
	});
});

// ...which is why nothing may put a rung on those two. The assertion above only
// describes the merge; this is what stops the combination reaching the DOM.
describe('the responsive-pair trap', () => {
	it('puts no type token on <Input> or <Textarea>', () => {
		const SRC = new URL('..', import.meta.url);
		const offenders: string[] = [];

		for (const file of readdirSync(SRC, {
			recursive: true,
			encoding: 'utf8',
		})) {
			if (!/\.tsx$/.test(file)) continue;
			for (const [tag] of readFileSync(new URL(file, SRC), 'utf8').matchAll(
				/<(?:Input|Textarea)\b[^>]*>/g
			)) {
				if (/\bt-(?:h|b|l)-[a-z0-9]+\b|\bt-spec\b/.test(tag)) {
					offenders.push(`${file}: ${tag.slice(0, 80)}`);
				}
			}
		}

		expect(offenders).toEqual([]);
	});
});
