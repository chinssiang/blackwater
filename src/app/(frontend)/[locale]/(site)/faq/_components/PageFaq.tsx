'use client';

import FaqBlock, { type FaqItem } from '@/components/FaqBlock';
import SectionShell, {
	type SectionAppearance,
} from '@/components/SectionShell';

interface PageFaqData {
	title?: string | null;
	intro?: string | null;
	items?: FaqItem[];
}

interface PageFaqProps {
	data?: PageFaqData;
}

// ONE measure for the whole page, handed to both shells so the heading and the
// accordion cannot drift apart.
//
// This page used to cap itself with `p-x-md` on its own wrapper -- padding, not
// a width -- which compounded with the `p-x-max` FaqBlock's own <SectionShell>
// applies inside it: 510px + 58px a side at 1920px, leaving the accordion ~500px
// narrower than the 900px that padding was aiming at. (The same class list also
// carried `px-max`, which emitted nothing at all: Tailwind's `px-*` reads the
// `--spacing-*` namespace and the theme declares no `--spacing-max`.)
//
// So the page hand-writes no horizontal padding at all now. <SectionShell> is
// the single owner of a section's inset, and it picks the right one for a capped
// box -- see the `--section-inset` note in lib/utils.ts.
const FAQ_MAX_WIDTH = 'l';

// Tailwind scale steps, replacing the wrapper's `py-10 lg:py-17.5` and the
// block's `mt-10`. NOT a like-for-like swap at every width: `section-spacing`
// puts its `*Desktop` values behind `@variant sm`, so the 70px step now opens at
// 640px where the class opened it at 1024px. Deliberate -- that is how every
// page module on the site already spaces itself, and this page is now one.
//
// `satisfies`, not a bare literal: BLOCK_APPEARANCE reaches the resolver through
// FaqBlock's `sectionAppearance?: any`, so a mistyped key would otherwise
// compile and silently render DEFAULT_SPACING instead.
const HEADER_APPEARANCE = {
	maxWidth: FAQ_MAX_WIDTH,
	spacingTop: 10,
	spacingTopDesktop: 17.5,
	spacingBottom: 0,
	spacingBottomDesktop: 0,
} satisfies SectionAppearance;

const BLOCK_APPEARANCE = {
	maxWidth: FAQ_MAX_WIDTH,
	spacingTop: 10,
	spacingTopDesktop: 10,
	spacingBottom: 10,
	spacingBottomDesktop: 17.5,
} satisfies SectionAppearance;

export function PageFaq({ data }: PageFaqProps) {
	const { title, intro, items } = data || {};

	return (
		<div className="md:min-h-main min-h-[85vh]">
			{/* The <h1> is written out rather than passed as the shell's `heading`,
			    which renders the same `t-h-2 uppercase`: the shell wraps a heading in
			    a `mb-6` row so the action slot can share it, and the intro below
			    wants `mt-2`. Passing it would triple the gap. */}
			<SectionShell appearance={HEADER_APPEARANCE} className="text-foreground">
				{title && <h1 className="t-h-2 uppercase">{title}</h1>}
				{intro && <p className="mt-2 whitespace-pre-line">{intro}</p>}
			</SectionShell>
			<FaqBlock data={{ items, sectionAppearance: BLOCK_APPEARANCE }} />
		</div>
	);
}
