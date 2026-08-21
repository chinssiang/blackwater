'use client';

import { VisualEditing } from 'next-sanity/visual-editing';
import { SanityLive } from '@/sanity/lib/live';
import DraftModeToast from '@/components/DraftModeToast';

/**
 * The draft-mode-only trio, in one module so `HtmlShell` can load it lazily.
 *
 * These were previously static imports in HtmlShell, rendered behind
 * `{isDraftModeEnabled && …}`. The condition gated *rendering*, not *bundling*:
 * the imports are resolved at build time, so every published visitor downloaded
 * the Visual Editing machinery (@sanity/comlink and its channel/overlay code) and
 * never executed a line of it. Lighthouse measured that chunk at 78KB raw /
 * ~24KB transferred and **99% unused** on /products.
 *
 * Behind next/dynamic in HtmlShell this chunk is only requested when draft mode
 * is actually on.
 *
 * Live Content API: only subscribe in draft mode. For published traffic content
 * stays fresh via the /api/revalidate-tag webhook. Rendering <SanityLive> for
 * anonymous visitors on Next.js 16 + next-sanity 12 triggers a
 * prefetch/revalidate cascade (4–10x request overage).
 * See https://www.sanity.io/docs/help/nextjs-16-sanitylive-status
 */
export default function DraftModeTools() {
	return (
		<>
			<SanityLive refreshOnFocus />
			<DraftModeToast />
			<VisualEditing />
		</>
	);
}
