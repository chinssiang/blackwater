import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A label-as-button in the site chrome: the cart and menu triggers in the
 * header, and the close controls in the overlays they open.
 *
 * Extracted because four hand-maintained copies of this class string had
 * already drifted. Two carried a focus ring and two carried none; and when the
 * two header triggers were raised to `h-header` to become reachable on touch,
 * both overlay closes were left at the height of their own `size-4` icon.
 * Height is the thing this component exists to own: these controls paint no
 * background and no border, so nothing about them signals how large their box
 * is, and every copy has to be corrected by hand.
 *
 * Every call site sits in a row that is itself `h-header` — the real header,
 * the mobile menu's top bar, the cart drawer's title row — so `h-header` here
 * always resolves to the height of the row the control sits in.
 *
 * What this owns: the type style, the row height, the focus treatment, the flex
 * box. What stays at the call site: placement (`ml-auto`, `max-lg:mr-3`),
 * visibility (`lg:hidden`), minimum widths, and the extra inset an icon-only
 * control needs. Those differ per site and are layout, not vocabulary.
 *
 * Composes with Radix through *their* `asChild`, not one of its own:
 * `<Dialog.Close asChild><ChromeButton …/></Dialog.Close>`.
 */
export default function ChromeButton({
	className,
	type = 'button',
	...props
}: React.ComponentProps<'button'>) {
	return (
		<button
			type={type}
			data-slot="chrome-button"
			className={cn(
				// Deliberately NO `focus:outline-none` here. The call sites this was
				// extracted from all carried it, and the compiled CSS shows why that
				// painted nothing at all:
				//
				//   .focus\:outline-none:focus       { --tw-outline-style: none;
				//                                     outline-style: none }
				//   .focus-visible\:outline-2:...    { outline-style:
				//                                     var(--tw-outline-style);
				//                                     outline-width: 2px }
				//
				// `:focus-visible` is a subset of `:focus`, so both rules applied and
				// `outline-style` resolved to `none`: 2px of nothing. The cart and
				// menu triggers had no visible keyboard focus (WCAG 2.4.7). Modern
				// engines only paint the UA ring on `:focus-visible` anyway, so
				// dropping it loses nothing and restores the outline.
				//
				// `outline-current` rather than a fixed colour: this control renders
				// on the dark header and on the light cart panel, and currentColor is
				// the readable ink in both.
				't-b-2 flex h-header cursor-pointer items-center gap-1 uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current',
				className
			)}
			{...props}
		/>
	);
}
