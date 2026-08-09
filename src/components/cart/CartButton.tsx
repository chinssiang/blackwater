'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from '@/components/LocaleProvider';
import { interpolate, pickPlural } from '@/lib/dictionary';
import { isCommercePath } from '@/lib/routes';
import { useCart } from './CartProvider';

/**
 * Header trigger. The count is deliberately absent until the cart hydrates
 * after mount — rendering a "0" first would flash to the real number on every
 * page load for shoppers who already have a cart.
 *
 * Only shown where there is something to buy, plus anywhere the cart already
 * holds items: hiding it outright would strand a shopper who wandered from
 * /products to /events with two tees in their cart and no way back to checkout.
 * The rule lives here rather than in Header so it can read cart state without
 * threading a prop through Header's Sanity-typed props.
 */
export default function CartButton() {
	const t = useTranslations('cart');
	const pathname = usePathname();
	const { cart, setOpen } = useCart();
	const count = cart?.totalQuantity ?? 0;

	if (count === 0 && !isCommercePath(pathname)) return null;

	return (
		<button
			type="button"
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
			className="t-b-2 flex cursor-pointer items-center gap-1 uppercase focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
		>
			<span>{t.title}</span>
			{count > 0 && <span aria-hidden="true">({count})</span>}
		</button>
	);
}
