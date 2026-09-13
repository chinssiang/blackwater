import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The weather widget has three mount sites and no route predicate: whoever owns
 * a page's content region mounts it -- <HeroBlock> inside its hero, PageHome's
 * fallback when no hero does, and the two events pages inside their own roots.
 *
 * That rule replaced a `shouldShowWeatherWidget(pathname)` arm in <Layout>, and
 * the history is why this file exists at all: commit 3a81c53 moved a mount into
 * <HeroBlock>, left that predicate computed-but-unused, and every test kept
 * passing while /events silently lost its widget and a two-hero page silently
 * gained a second one. The predicate is gone now, so the shape of the bug has
 * inverted -- reviving that arm would DUPLICATE the events widget rather than
 * remove it -- and the 'chrome arm' describe below is the guard for that.
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
 * `ownsWeatherWidget && <WeatherWidget`, across any amount of intervening
 * whitespace or JSX.
 *
 * The lookbehind is load-bearing: unanchored, `!ownsWeatherWidget && <Weather…`
 * also matched, so an INVERTED gate — widget on every hero except its owner —
 * passed every assertion here. Rejecting a preceding `!` or word character keeps
 * the formatting tolerance without that hole.
 */
const RENDERS_FOR_OWNER =
	/(?<![!\w.])ownsWeatherWidget\s*&&[\s\S]{0,120}?<WeatherWidget/;

/** `<WeatherWidget…` but not `<WeatherWidgetRail…`. */
const MOUNTS_WIDGET_DIRECTLY = /<WeatherWidget(?![A-Za-z])/;

const EVENT_PAGE_MOUNTS = [
	[
		'PageEvents',
		'app/(frontend)/[locale]/(site)/events/_components/PageEvents.tsx',
	],
	[
		'PageEventSingle',
		'app/(frontend)/[locale]/(site)/events/_components/PageEventSingle.tsx',
	],
] as const;

describe('the mounts on the events routes', () => {
	it.each(EVENT_PAGE_MOUNTS)('%s mounts through the rail', (_n, path) => {
		// Unconditional and unowned, unlike the hero arm below: an events route
		// renders exactly one of these two components and neither can contain a
		// heroBlock, so the page itself is the gate.
		//
		// Through <WeatherWidgetRail> and never around it. The rail is what keeps
		// the widget out of flow; a page reaching past it to <WeatherWidget> gets a
		// bottom-anchored box sitting IN flow, which is the bug the rail exists for
		// -- opening the panel then moves the newsletter and the footer.
		const source = read(path);
		expect(source).toContain('<WeatherWidgetRail');
		expect(source).toContain("from '@/components/WeatherWidgetRail'");
		expect(source).not.toMatch(MOUNTS_WIDGET_DIRECTLY);
	});
});

describe('the rail', () => {
	const rail = read('components/WeatherWidgetRail.tsx');

	// Every assertion below reads the CLASS STRING, never the file: this
	// component is mostly docblock, and both `sticky` and `h-11` are named in
	// that prose -- matched loosely, a rail that had lost the class would still
	// pass on its own explanation of why it needs it (it did, first try).
	const railClasses = rail.match(/cn\(\s*'([^']*)'/)?.[1] ?? '';

	it('is the sticky element, with the widget in flow inside it', () => {
		// Sticky on the RAIL, not the widget: the widget's panel is in flow below
		// its trigger, so a bottom-anchored widget that is itself sticky turns
		// opening it into real layout. `fixed` is the chrome spelling this replaced.
		expect(railClasses).toMatch(/\bsticky\b/);
		expect(railClasses).not.toMatch(/\bfixed\b/);
	});

	it('lays the widget out so the panel overflows upward', () => {
		// The mechanism, and all of it silent if removed. An over-tall flex item
		// overflows its container's START edge, so `items-end` is what pins the
		// widget's bottom while the panel grows past the top -- without it the
		// default `stretch` holds the widget at 44px and clips the panel. Without
		// `justify-end` the pill jumps to the left edge.
		expect(railClasses).toMatch(/\bitems-end\b/);
		expect(railClasses).toMatch(/\bjustify-end\b/);
	});

	it('renders the widget in flow, not absolutely', () => {
		// `static` is what puts the widget in the rail's flow so `items-end` can
		// align it; back on the component's `absolute` default the 44px reserve
		// means nothing and the layout push the rail exists to stop returns.
		// Asserted on the JSX, not the rail's own class string.
		expect(rail).toMatch(/<WeatherWidget[^>]*\bstatic\b/);
	});

	it('does not absorb clicks meant for the page beneath it', () => {
		// The rail is as wide as its container and the pill is at most 256px, so
		// the rest of that 44px band is an invisible bar pinned across the bottom
		// of the viewport -- measured at 1024px, 707px of it sitting on two event
		// rows' stretched links. It absorbs them even before the first fetch
		// resolves, when the widget renders nothing. `products/layout.tsx` and
		// `ProductSubmission.tsx` carry the same pair.
		expect(railClasses).toMatch(/\bpointer-events-none\b/);
		expect(rail).toMatch(/<WeatherWidget[^>]*\bpointer-events-auto\b/);
	});

	it('reserves a constant height that clears the collapsed pill', () => {
		// The reserve is what makes the rail's own box -- the only part that is
		// layout -- independent of whether the panel is open. `h-11` is 44px
		// against a pill of 40-41.5px; see the note in the component for the sum.
		expect(railClasses).toMatch(/\bh-11\b/);
	});

	it('imports through the lazy boundary, not the component directly', () => {
		expect(rail).toContain("from '@/components/WeatherWidgetLazy'");
		expect(rail).not.toMatch(/from '@\/components\/WeatherWidget'/);
	});
});

describe('the chrome arm, which must stay gone', () => {
	it('is not mounted from <Layout>', () => {
		// Two widgets on one page poll /api/weather on separate schedules and show
		// separate timestamps -- the same bug the hero arm's ownership gate exists
		// to prevent, and <Layout> is mounted on every events route.
		expect(read('components/layout/index.tsx')).not.toContain('<WeatherWidget');
	});

	it('has no route predicate left to revive it', () => {
		// A restored `shouldShowWeatherWidget` is how that arm comes back, so the
		// name must not exist for anyone to wire up again.
		expect(read('lib/routes.ts')).not.toContain('shouldShowWeatherWidget');
	});
});

describe('the structural mount in <HeroBlock>', () => {
	const hero = read('components/HeroBlock.tsx');

	it('renders the widget only for the hero that owns it', () => {
		// Unconditional here is the two-widget bug: neither pageModules array caps
		// how many heroBlocks it accepts.
		expect(hero).toMatch(RENDERS_FOR_OWNER);
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
