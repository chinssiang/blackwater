import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The weather widget has two mount sites and a predicate governing one of them.
 * `routes.test.ts` proves the predicate ANSWERS correctly; nothing proved it was
 * still READ, and that is precisely what broke: commit 3a81c53 moved the mount
 * into <HeroBlock>, left `shouldShowWeatherWidget` computed-but-unused in
 * <Layout>, and every test kept passing while /events silently lost its widget
 * and a two-hero page silently gained a second one.
 *
 * So these read the repo's own source. That is the same tactic
 * `schemaTypes/objects/page-module.test.ts` uses to discover page modules by
 * their registration string, and it is here for the same reason: the invariant
 * is "these files are wired to each other", which no amount of testing either
 * file alone can see. vitest.config.ts is `environment: 'node'` with no jsdom by
 * design, so rendering the components is not the alternative.
 *
 * The patterns below are deliberately TOLERANT of formatting -- they check that
 * a gate and a render appear in the same expression, never that either is
 * spelled a particular way. A guard that fails when Prettier rewraps a line, or
 * when a prop is added, trains the next person to edit the assertion until it
 * passes, which is the rot it exists to prevent. `page-module.test.ts` matches
 * `/<(\w+)[^>]*\bheadingLevel=/g` for the same reason.
 */
const read = (path: string) =>
	readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/**
 * `gate && <WeatherWidget`, across any amount of intervening whitespace or JSX.
 *
 * The lookbehind is load-bearing: unanchored, `!ownsWeatherWidget && <Weather…`
 * also matched, so an INVERTED gate — widget on every hero except its owner —
 * passed every assertion here. Rejecting a preceding `!` or word character keeps
 * the formatting tolerance without that hole.
 */
const rendersWhen = (gate: string) =>
	new RegExp(`(?<![!\\w.])${gate}\\s*&&[\\s\\S]{0,120}?<WeatherWidget`);

describe('the chrome mount in <Layout>', () => {
	const layout = read('components/layout/index.tsx');

	it('renders the widget rather than only computing the predicate', () => {
		// The exact shape of the original bug: the call present, the render absent.
		expect(layout).toContain('shouldShowWeatherWidget(pathname)');
		expect(layout).toContain('<WeatherWidget');
	});

	it('gates that render on the predicate', () => {
		expect(layout).toMatch(rendersWhen('showWeather'));
	});

	it('escapes the flow, having no hero to sit inside', () => {
		// `absolute` is the component default and would anchor to whatever
		// positioned ancestor it happened to find in the chrome.
		expect(layout).toMatch(/<WeatherWidget[\s\S]{0,120}?fixed/);
	});

	it('imports through the lazy boundary, not the component directly', () => {
		// A static import from the always-mounted chrome would put the widget and
		// @/lib/weather into every route's shared chunk.
		expect(layout).toContain("from '@/components/WeatherWidgetLazy'");
		expect(layout).not.toMatch(/from '@\/components\/WeatherWidget'/);
	});
});

describe('the structural mount in <HeroBlock>', () => {
	const hero = read('components/HeroBlock.tsx');

	it('renders the widget only for the hero that owns it', () => {
		// Unconditional here is the two-widget bug: neither pageModules array caps
		// how many heroBlocks it accepts.
		expect(hero).toMatch(rendersWhen('ownsWeatherWidget'));
	});

	it('imports through the lazy boundary', () => {
		expect(hero).toContain("from '@/components/WeatherWidgetLazy'");
	});
});

describe('the ownership signal', () => {
	it('is threaded to heroBlock by PageModules', () => {
		// Bounded to the one element, and the value must be the prop rather than a
		// literal: `ownsWeatherWidget={true}` would satisfy a looser pattern while
		// giving every hero a widget, and `={false}` while giving none of them one.
		expect(read('components/PageModules.tsx')).toMatch(
			/<HeroBlock[^>]*?ownsWeatherWidget=\{ownsWeatherWidget\}/
		);
	});

	it.each([
		['PageHome', 'app/(frontend)/[locale]/_components/PageHome.tsx'],
		['PageGeneral', 'app/(frontend)/[locale]/_components/PageGeneral.tsx'],
	])('is decided by %s from the first renderable hero', (_n, path) => {
		const source = read(path);
		// The election and the prop must be CONNECTED, not merely both present:
		// `ownsWeatherWidget={module._type === 'heroBlock'}` contains both halves
		// and is exactly the two-widget regression this file exists to catch.
		expect(source).toMatch(
			/const widgetHeroKey = [\s\S]{0,200}?_type === 'heroBlock'/
		);
		// Gating on an index would leave a [freeform, heroBlock] page with a hero
		// at index 1 and no widget anywhere on it.
		expect(source).toMatch(/ownsWeatherWidget=\{[^}]*widgetHeroKey/);
		// Electing on `_type` alone hands the widget to an empty placeholder hero,
		// which then bails to null and takes it off the page.
		expect(source).toMatch(/heroBlockIsRenderable/);
	});
});
