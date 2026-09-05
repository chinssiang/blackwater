'use client';

import { useState } from 'react';
import {
	Popover,
	PopoverContent,
	PopoverTitle,
	PopoverTrigger,
} from '@/components/Popover';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Plus } from '@/components/SvgIcons';
import { useCartActions } from '@/components/cart/CartProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { interpolate } from '@/lib/dictionary';
import { cn } from '@/lib/utils';
import type { CardAddToCart } from '@/lib/shopify/types';

// Quick add from a listing card. Only ever rendered when the server resolved a
// `CardAddToCart` for the product, so there is nothing to decide here about
// whether the product is linked, in stock, or simple enough to sell from a
// card — see `deriveCardAddToCart`.

type Props = {
	addToCart: CardAddToCart;
	productTitle: string;
};

/**
 * Sits where the card's "View" affordance sits, and is styled to match it.
 *
 * `relative z-10` puts it above the card's stretched overlay link (`z-0`), so
 * the control takes its own clicks rather than navigating. `-my-2 py-2` grows
 * the tap target past WCAG's 24px minimum: `.t-l-2` is 11px, so the bare inline
 * box fell well short. The negative margin keeps that growth inside the footer
 * row's own box, so the enlarged hit area neither shifts the row nor overhangs
 * into blank card space where it would steal the overlay link's clicks.
 *
 * The label never changes while a request is out: on a two-up mobile grid the
 * card gives this ~80px beside the price, and swapping in a longer word would
 * reflow the row mid-click. The trailing glyph carries the state instead, and
 * the drawer opening is the real confirmation.
 */
function AddTrigger({
	label,
	ariaLabel,
	pending,
	...props
}: {
	label: string;
	ariaLabel: string;
	pending: boolean;
} & React.ComponentProps<'button'>) {
	return (
		// `{...props}` FIRST: in the picker case this component is handed to Base
		// UI's `render`, which merges the trigger's own props -- ref, id, onClick,
		// aria-haspopup/expanded -- onto this element. Spreading last would let
		// them overwrite the className and the per-product aria-label below.
		<button
			{...props}
			type="button"
			aria-label={ariaLabel}
			disabled={pending}
			className="t-l-2 relative z-10 -my-2 inline-flex cursor-pointer items-center gap-1 py-2 uppercase text-foreground/65 transition-colors duration-200 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
		>
			{label}
			{pending ? (
				<Spinner className="size-[1.1em]" />
			) : (
				<Plus className="size-[1.1em]" />
			)}
		</button>
	);
}

export default function ProductCardAddToCart({
	addToCart,
	productTitle,
}: Props) {
	const t = useTranslations('cart');
	// Actions only: this dispatches into the cart but renders none of its state,
	// so a stepper in the open drawer must not re-render every card in the grid.
	const { addLine, setOpen: setCartOpen } = useCartActions();
	// Local rather than the cart's global `isPending`, which also fires for the
	// drawer's own steppers and would spin every card at once.
	const [isAdding, setIsAdding] = useState(false);
	const [pickerOpen, setPickerOpen] = useState(false);

	const ariaLabel = interpolate(t.addAriaLabel, { product: productTitle });

	const add = async (merchandiseId: string) => {
		setIsAdding(true);
		const added = await addLine(merchandiseId);
		setIsAdding(false);
		// Same confirmation the detail page gives. A failed add has already
		// surfaced its own toast from CartProvider, so nothing opens.
		if (added) {
			setPickerOpen(false);
			setCartOpen(true);
		}
	};

	if (addToCart.kind === 'direct') {
		return (
			<AddTrigger
				label={t.add}
				ariaLabel={ariaLabel}
				pending={isAdding}
				onClick={() => add(addToCart.merchandiseId)}
			/>
		);
	}

	return (
		<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
			<PopoverTrigger
				render={
					<AddTrigger label={t.add} ariaLabel={ariaLabel} pending={isAdding} />
				}
			/>
			{/* A popover, not a row that opens inside the card: cards sit in a CSS
			    grid, so anything that grows one grows its whole row. The portal also
			    brings Escape, outside-dismiss and the trigger's aria wiring, none of
			    which is worth hand-rolling. Narrower than PopoverContent's `w-72`
			    default, which is wider than a card. */}
			<PopoverContent
				side="top"
				align="end"
				className="w-auto min-w-40 max-w-56 gap-2"
			>
				<PopoverTitle className="t-l-2 uppercase text-foreground/65">
					{addToCart.optionName}
				</PopoverTitle>
				<div className="flex flex-wrap gap-2">
					{addToCart.values.map((value) => (
						<Button
							key={value.value}
							type="button"
							variant="outline"
							size="lg"
							// Unavailable values are struck through as they are on the
							// detail page, but disabled rather than clickable. There they
							// stay clickable so a shopper can reach the back-in-stock form
							// for the exact variant they want; a card has no such form, so
							// a click would have nowhere to go. The card itself still links
							// to the page that does.
							disabled={!value.availableForSale || isAdding}
							onClick={() => add(value.merchandiseId)}
							className={cn(
								't-l-2 min-h-11 min-w-11 px-3.5 uppercase',
								!value.availableForSale && 'line-through decoration-1'
							)}
						>
							{value.value}
						</Button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
