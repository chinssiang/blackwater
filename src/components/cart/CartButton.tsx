'use client';

import ChromeButton from '@/components/ChromeButton';
import { useTranslations } from '@/components/LocaleProvider';
import { interpolate, pickPlural } from '@/lib/dictionary';
import CartCountBadge from './CartCountBadge';
import { useCart } from './CartProvider';

/**
 * Header trigger. The count is deliberately absent until the cart hydrates
 * after mount — rendering a "0" first would flash to the real number on every
 * page load for shoppers who already have a cart.
 *
 * Shown on every page: the cart is a shopper's own state, and hiding the way
 * back to it off the product routes stranded anyone who wandered to /events
 * mid-purchase. An empty cart renders the label alone, without a badge.
 */
export default function CartButton() {
	const t = useTranslations('cart');
	const { cart, setOpen } = useCart();
	const count = cart?.totalQuantity ?? 0;

	return (
		<ChromeButton
			onClick={() => setOpen(true)}
			// The label carries the count, because aria-label replaces the text
			// content outright — without it a screen reader hears "Open cart"
			// identically whether the cart holds three items or none, and the count
			// is the only state this control exists to convey. Reuses the drawer's
			// own itemCount phrasing rather than adding a parallel string.
			aria-label={
				count > 0
					? `${t.open}, ${interpolate(pickPlural(t.itemCount, count), { count })}`
					: t.open
			}
			className="max-lg:mr-3"
		>
			{/* `relative` belongs on the label, not the button: ChromeButton fills
			    the header row, and anchored to that the badge would hang off the top
			    of the header rather than off the word. */}
			<span className="relative inline-flex">
				{t.title}
				{count > 0 && (
					<CartCountBadge count={count} className="absolute -top-2 -right-4" />
				)}
			</span>
		</ChromeButton>
	);
}
