'use client';

import { VisualEditing } from 'next-sanity/visual-editing';
import DraftModeToast from '@/components/DraftModeToast';

/**
 * The draft-mode-only CLIENT pair, split into its own module so that
 * `DraftModeTools` — not HtmlShell — can hold it behind a `lazy()`.
 *
 * Both were once static imports in HtmlShell rendered behind
 * `{isDraftModeEnabled && …}`, and for a **client** component that gates
 * *rendering*, not *bundling*: the import is resolved at build time, so every
 * published visitor downloaded the Visual Editing machinery and never executed a
 * line of it. Lighthouse measured 78KB raw / ~24KB transferred, **99% unused** on
 * /products for that static-import shape. Behind the `lazy()` it is fetched only
 * when draft mode is on.
 *
 * That reasoning does NOT extend to `<SanityLive>`, which is why HtmlShell still
 * has a `{isDraftModeEnabled && …}` of its own — do not read it as an unreverted
 * regression and move it back in here. It is a Server Component and ships no
 * client reference of its own to defer; `src/sanity/lib/live.ts` has the
 * mechanism, and importing it from this 'use client' module is what threw
 * "defineLive can only be used in React Server Components" and took Presentation
 * down.
 */
export default function DraftModeToolsInner() {
	return (
		<>
			<DraftModeToast />
			<VisualEditing />
		</>
	);
}
