import { stegaClean } from '@sanity/client/stega';
import type { SectionAppearance } from '@/lib/section-appearance';
import { hasArrayValue } from '@/lib/utils';

// A leaf module, so the page components and the Node test suite can ask
// whether a hero renders without importing <HeroBlock>'s client graph — the
// same reason `ui/tabsTriggerVariants.ts` lives apart from `Tabs.tsx`.

export type HeroBlockData = {
	eyebrow?: string | null;
	heading?: string | null;
	paragraph?: any;
	backgroundImage?: any;
	// Resolved to a boolean in GROQ (heroBlockField), never the raw string.
	waveBackground?: boolean | null;
	callToAction?: {
		label?: string | null;
		link?: { href?: unknown; isNewTab?: boolean | null } | null;
	} | null;
	sectionAppearance?: SectionAppearance;
};

/**
 * Whether a heroBlock will render anything at all — exported so callers gate on
 * the SAME condition this component bails on, the idiom `<SizeChartTable>`'s
 * `isRenderable()` sets. The page components need it to elect which hero owns
 * the weather widget: electing on `_type` alone handed the widget to an empty
 * placeholder hero, which then returned null and took the page's only widget
 * with it while a fully authored hero below rendered without one.
 *
 * `stegaClean` on the heading for the reason the note inside the component
 * gives: draft mode appends invisible characters that make any heading look
 * non-empty, and this COMPARES rather than renders.
 */
export function heroBlockIsRenderable(data: HeroBlockData): boolean {
	const {
		eyebrow,
		heading,
		paragraph,
		backgroundImage,
		waveBackground,
		callToAction,
	} = data || {};
	const ctaHref =
		typeof callToAction?.link?.href === 'string'
			? callToAction.link.href
			: null;
	return !!(
		eyebrow ||
		stegaClean(heading)?.trim() ||
		hasArrayValue(paragraph) ||
		backgroundImage?.image ||
		waveBackground ||
		(ctaHref && callToAction?.label)
	);
}
