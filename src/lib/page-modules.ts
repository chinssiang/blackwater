import { stegaClean } from '@sanity/client/stega';

// Which module, if any, owns a page's heading.
//
// pHome used to guarantee an <h1> unconditionally through `landingTitle`. That
// guarantee now belongs to a heroBlock, which an editor can leave empty, or
// reorder below another module -- so "is there a hero" is not the question; "is
// there a hero that will actually render a heading" is. Both PageHome's
// transition tail and its headingLevel assignment read the answer from here so
// they cannot disagree.

const HERO_TYPE = 'heroBlock';

type PageModuleLike = {
	_type?: string | null;
	_key?: string | null;
	heading?: string | null;
} | null;

/** The rendered heading of a heroBlock, or null for anything else. */
export function heroHeading(module: PageModuleLike): string | null {
	if (module?._type !== HERO_TYPE) return null;
	// Trimmed and stega-cleaned so a whitespace-only or draft-mode heading is not
	// mistaken for content the page can hang its <h1> on.
	const heading = stegaClean(module.heading)?.trim();
	return heading ? heading : null;
}

/**
 * `_key` of the first heroBlock carrying a heading, or null when no module
 * supplies one.
 */
export function findHeadingHeroKey(
	modules: PageModuleLike[] | null | undefined
): string | null {
	const owner = (modules ?? []).find((m) => heroHeading(m) !== null);
	return owner?._key ?? null;
}
